// 카메라와 은하 좌표계를 공유해야 별과 성운이 시점 이동 중 서로 미끄러지지 않는다.
export const sceneCoordinates = `
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_aspect;
uniform float u_portrait;
mat2 rotate2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 galaxyCenter() { return mix(vec3(-3.5, -1.8, 0.0), vec3(0.0, 5.0, 0.0), u_portrait); }
vec3 cameraPosition() {
  return vec3(sin(u_time * .055) * 2.3 + u_pointer.x * 3.2,
    cos(u_time * .043) * .8 + u_pointer.y * 1.8,
    mix(26.0, 34.0, u_portrait) + sin(u_time * .037) * 1.3 + exp(-u_time * .22) * 3.0);
}
mat3 cameraBasis(vec3 eye) {
  vec3 forward = normalize(vec3(0.0, 0.0, 0.0) - eye);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  return mat3(right, cross(right, forward), forward);
}
vec3 toGalaxy(vec3 p) {
  p -= galaxyCenter();
  p.xy = rotate2(.48) * p.xy;
  p.yz = rotate2(.97) * p.yz;
  p.xy = rotate2(u_time * .009) * p.xy;
  return p;
}
vec3 fromGalaxy(vec3 p) {
  p.xy = rotate2(-u_time * .009) * p.xy;
  p.yz = rotate2(-.97) * p.yz;
  p.xy = rotate2(-.48) * p.xy;
  return p + galaxyCenter();
}
`;

export const volumeVertex = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0.0, 1.0); }
`;

export const volumeFragment = `#version 300 es
precision highp float;
precision highp sampler3D;
${sceneCoordinates}
uniform vec2 u_resolution;
uniform sampler3D u_noise;
uniform int u_steps;
out vec4 outColor;
float noise3(vec3 p) { return texture(u_noise, p / 64.0).r; }
float clouds(vec3 p) {
  return noise3(p) * .5 + noise3(p * 2.03 + 13.0) * .32 + noise3(p * 4.07 + 27.0) * .18;
}
vec2 intersectBox(vec3 ro, vec3 rd) {
  vec3 inv = 1.0 / (sign(rd) * max(abs(rd), vec3(.00001)));
  vec3 a = (-vec3(16.0, 16.0, 3.8) - ro) * inv;
  vec3 b = (vec3(16.0, 16.0, 3.8) - ro) * inv;
  vec3 nearP = min(a, b), farP = max(a, b);
  return vec2(max(max(nearP.x, nearP.y), nearP.z), min(min(farP.x, farP.y), farP.z));
}
void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 eye = cameraPosition();
  vec3 ray = cameraBasis(eye) * normalize(vec3(uv, 2.0));
  vec3 ro = toGalaxy(eye);
  vec3 rd = toGalaxy(eye + ray) - ro;
  vec2 hit = intersectBox(ro, rd);
  if (hit.y <= max(hit.x, 0.0)) { outColor = vec4(0.0); return; }
  float start = max(hit.x, 0.0);
  float stepSize = (hit.y - start) / float(u_steps);
  // 표본 위치를 프레임마다 바꾸지 않아 정지 화면의 노이즈와 시간에 따른 깜빡임을 피한다.
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 radiance = vec3(0.0);
  float transmission = 1.0;
  for (int i = 0; i < 64; i++) {
    if (i >= u_steps) break;
    vec3 p = ro + rd * (start + (float(i) + jitter) * stepSize);
    float radius = length(p.xy);
    if (radius > 15.5) continue;
    float height = .19 + radius * .032 + exp(-radius * .85) * .9;
    float vertical = exp(-abs(p.z) / height);
    if (vertical < .006) continue;
    float n = clouds(p * 2.5 + vec3(5.0, 11.0, u_time * .008));
    float theta = atan(p.y, p.x);
    float arms = pow(.5 + .5 * cos(theta * 3.0 - log(radius + .8) * 7.8 + n * 2.3), 3.0);
    float envelope = exp(-radius * .17) * (1.0 - smoothstep(10.0, 15.5, radius));
    float density = vertical * envelope * (.24 + arms * 1.7);
    float detail = smoothstep(.2, .76, n);
    float dust = smoothstep(.43, .68, clouds(p * 3.3 + 31.0));
    vec3 warm = vec3(2.0, .91, .34);
    vec3 cool = mix(vec3(.22, .57, 1.7), vec3(.12, 1.0, 1.2), smoothstep(.48, .65, n));
    vec3 gas = mix(warm, cool, smoothstep(2.0, 10.0, radius));
    vec3 emission = gas * density * detail * 1.3;
    float nucleus = exp(-length(p * vec3(1.0, 1.0, 2.5)) * 1.35);
    emission += vec3(7.0, 4.2, 2.0) * nucleus;
    float extinction = density * (.35 + dust * 5.0 * smoothstep(.6, 3.0, radius));
    float opacity = 1.0 - exp(-extinction * stepSize);
    radiance += transmission * emission * stepSize;
    transmission *= 1.0 - opacity;
    if (transmission < .025) break;
  }
  radiance = 1.0 - exp(-radiance * 1.4);
  outColor = vec4(radiance, 1.0 - transmission);
}
`;

export const starVertex = `#version 300 es
precision highp float;
${sceneCoordinates}
in vec3 a_position;
in vec3 a_color;
in vec2 a_details;
uniform float u_height;
uniform float u_pixelRatio;
uniform int u_kind;
out vec3 v_color;
out float v_alpha;
void main() {
  vec3 p = a_position;
  if (u_kind == 1) p = fromGalaxy(p);
  if (u_kind == 2) p.z = mod(p.z + u_time * .7 + 35.0, 60.0) - 35.0;
  vec3 eye = cameraPosition();
  vec3 relative = transpose(cameraBasis(eye)) * (p - eye);
  float depth = relative.z;
  gl_Position = vec4(relative.x * 2.0 / u_aspect, relative.y * 2.0, depth - .2, depth);
  gl_PointSize = clamp(a_details.x * u_height / max(depth, .1), u_pixelRatio, 14.0 * u_pixelRatio);
  float pulse = .85 + .15 * sin(u_time * .7 + a_details.y);
  v_alpha = smoothstep(.7, 5.0, depth) * pulse;
  v_color = a_color;
  if (depth <= .1) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const starFragment = `#version 300 es
precision highp float;
in vec3 v_color;
in float v_alpha;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float core = exp(-d * d * 28.0);
  float glow = exp(-d * d * 4.0) * .12;
  float rays = pow(max(0.0, 1.0 - abs(p.x * p.y) * 70.0), 3.0) * pow(1.0 - d, 4.0) * .16;
  outColor = vec4(v_color * (core + glow + rays) * v_alpha, 1.0);
}
`;

// 부드러운 성운만 낮은 해상도로 계산하고 별과 화면은 원래 해상도로 합성한다.
export const compositeFragment = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_image;
out vec4 outColor;
void main() { outColor = texture(u_image, v_uv); }
`;
