// 선·행성·라벨의 원근 투영을 동일하게 유지해야 클릭 위치가 어긋나지 않는다.
export const cameraShader = `
uniform vec3 u_eye;
uniform mat3 u_basis;
uniform float u_aspect;
vec4 project(vec3 point) {
  vec3 p = transpose(u_basis) * (point - u_eye);
  return vec4(p.x * 1.9 / u_aspect, p.y * 1.9, p.z * 1.0002 - .20002, p.z);
}
`;

export const planetVertex = `#version 300 es
precision highp float;
${cameraShader}
layout(location=0) in vec3 a_position;
layout(location=1) in vec2 a_uv;
uniform vec3 u_center;
uniform float u_radius;
uniform float u_spin;
uniform float u_ring;
out vec3 v_normal;
out vec3 v_world;
out vec2 v_uv;
mat3 rotateY(float a) { float c=cos(a),s=sin(a); return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
mat3 tilt() { float c=cos(.42),s=sin(.42); return mat3(c,s,0.,-s,c,0.,0.,0.,1.); }
void main() {
  mat3 rotation = tilt() * rotateY(u_ring > .5 ? 0. : u_spin);
  v_normal = rotation * (u_ring > .5 ? vec3(0.,1.,0.) : a_position);
  v_world = u_center + rotation * a_position * u_radius;
  v_uv = a_uv;
  gl_Position = project(v_world);
}
`;

export const planetFragment = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_maps;
uniform vec3 u_eye;
uniform vec3 u_tint;
uniform float u_surface;
uniform float u_loaded;
uniform float u_clouds;
uniform float u_time;
uniform float u_ring;
uniform float u_halo;
uniform float u_selected;
out vec4 outColor;
in vec3 v_normal;
in vec3 v_world;
in vec2 v_uv;
void main() {
  vec3 n=normalize(v_normal),view=normalize(u_eye-v_world);
  vec3 light=normalize(-v_world + vec3(0.,1.,3.));
  float diffuse=max(dot(n,light),0.);
  if(u_halo>.5) {
    float rim=pow(1.-abs(dot(n,view)),3.5);
    float glow=u_surface>7.5 ? pow(abs(dot(n,view)),2.)*.38 : rim*.28;
    outColor=vec4(u_tint, glow * (1.+u_selected*.8));
    return;
  }
  if(u_ring>.5) {
    float r=v_uv.x;
    float gap=smoothstep(.61,.64,r)*(1.-smoothstep(.66,.70,r));
    float band=.62+.13*sin(r*190.)+.08*sin(r*530.);
    vec3 color=mix(vec3(.34,.27,.19),vec3(.87,.78,.60),band);
    float alpha=(.6+.18*sin(r*92.))*(1.-gap*.85)*smoothstep(0.,.05,r)*(1.-smoothstep(.95,1.,r));
    outColor=vec4(color*(.5+.5*abs(dot(n,light))),alpha);
    return;
  }
  vec3 albedo=u_loaded>.5 ? texture(u_maps,vec3(v_uv,u_surface)).rgb : u_tint;
  if(u_surface>7.5) {
    vec3 glow=albedo*vec3(1.6,1.15,.65)+vec3(.16,.045,.0);
    outColor=vec4(glow*(.85+.15*max(dot(n,view),0.)),1.);
    return;
  }
  if(u_surface<.5 && u_clouds>.5) {
    float clouds=texture(u_maps,vec3(fract(v_uv+vec2(u_time*.0015,0.)),9.)).r;
    albedo=mix(albedo,vec3(.95,.98,1.),clouds*.78);
  }
  float hemisphere=.11+.07*max(n.y,0.);
  vec3 color=albedo*(hemisphere+diffuse*.96);
  if(u_surface<.5) {
    float ocean=smoothstep(.02,.15,albedo.b-albedo.r);
    color+=vec3(.7,.85,1.)*pow(max(dot(reflect(-light,n),view),0.),42.)*ocean*.42;
  }
  float rim=pow(1.-max(dot(n,view),0.),3.0);
  color+=u_tint*rim*(.08+.16*diffuse);
  color+=u_tint*rim*u_selected*.22;
  outColor=vec4(color,1.);
}
`;

export const lineVertex = `#version 300 es
precision highp float;
${cameraShader}
layout(location=0) in vec3 a_position;
void main() { gl_Position=project(a_position); }
`;
export const lineFragment = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() { outColor=u_color; }
`;
export const skyVertex = `#version 300 es
layout(location=0) in vec2 a_position;
out vec2 v_uv;
void main() { v_uv=a_position; gl_Position=vec4(a_position,1.,1.); }
`;
export const skyFragment = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform mat3 u_basis;
uniform float u_aspect;
uniform sampler2D u_sky;
uniform float u_loaded;
out vec4 outColor;
float starHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main() {
  vec3 ray=u_basis*normalize(vec3(v_uv.x*u_aspect,v_uv.y,1.9));
  ray.xy=mat2(.9,-.436,.436,.9)*ray.xy;
  vec2 uv=vec2(atan(ray.z,ray.x)/6.283185+.5,asin(ray.y)/3.141593+.5);
  uv.x=fract(uv.x+.2);
  vec3 sky=texture(u_sky,uv).rgb;
  vec3 color=mix(vec3(.014,.026,.046),pow(sky,vec3(.72))*.66+vec3(.008,.014,.027),u_loaded);
  vec2 cell=uv*vec2(1600.,800.),local=fract(cell)-.5;
  float seed=starHash(floor(cell));
  float star=exp(-dot(local,local)*180.)*step(.996,seed);
  color+=mix(vec3(.48,.68,1.),vec3(1.,.85,.62),fract(seed*373.))*star*.75;
  float vignette=1.-.25*length(v_uv);
  outColor=vec4(color*vignette,1.);
}
`;
