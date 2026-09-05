import { compositeFragment, starFragment, starVertex, volumeFragment, volumeVertex } from './cosmic-shaders';

type Mesh = { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; count: number };
const uniformNames = ['u_time', 'u_pointer', 'u_aspect', 'u_portrait', 'u_resolution', 'u_noise', 'u_steps', 'u_height', 'u_pixelRatio', 'u_kind', 'u_image'] as const;
type Program = { program: WebGLProgram; uniforms: Record<typeof uniformNames[number], WebGLUniformLocation | null> };
export type CosmicRenderer = { setPaused: (paused: boolean) => void; dispose: () => void };

export function createCosmicRenderer(canvas: HTMLCanvasElement): CosmicRenderer {
  let context: WebGL2RenderingContext | null = null;
  try {
    context = canvas.getContext('webgl2', {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false,
    });
  } catch {
    // 브라우저가 GPU 접근을 차단해도 장식 때문에 로그인 전체가 실패하면 안 된다.
  }
  if (!context) {
    canvas.dataset.renderer = 'fallback';
    return { setPaused() {}, dispose() {} };
  }

  const gl = context;
  let paused = true;
  let disposed = false;
  let frame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let time = 0;
  let slowFrames = 0;
  let quality = 1;
  let width = 1;
  let height = 1;
  let ratio = 1;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let starProgram: Program | null = null;
  let volumeProgram: Program | null = null;
  let compositeProgram: Program | null = null;
  let volumeBuffer: WebGLFramebuffer | null = null;
  let volumeTexture: WebGLTexture | null = null;
  let volumeWidth = 1;
  let volumeHeight = 1;
  let screen: Mesh | null = null;
  let noise: WebGLTexture | null = null;
  const meshes: Mesh[] = [];
  const programs: WebGLProgram[] = [];

  function makeProgram(vertex: string, fragment: string): Program {
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL program allocation failed');
    programs.push(program);
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('WebGL shader allocation failed');
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(shaders.map(shader => gl.getShaderInfoLog(shader)).join('\n') || 'WebGL link failed');
      }
    } finally {
      shaders.forEach(shader => gl.deleteShader(shader));
    }
    const uniforms = Object.fromEntries(uniformNames.map(name => [name, gl.getUniformLocation(program, name)])) as Program['uniforms'];
    return { program, uniforms };
  }

  let seed = 71421;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(random(), .00001))) * Math.cos(random() * Math.PI * 2);

  function makeStars(kind: number, count: number): Mesh {
    const data = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number, size: number;
      let red = .65, green = .8, blue = 1;
      if (kind === 1) {
        const radius = Math.pow(random(), .7) * 14.5;
        const angle = (i % 3) * Math.PI * 2 / 3 + Math.log(radius + .8) * 2.6 + gaussian() * (.13 + radius * .017);
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
        z = gaussian() * (.1 + radius * .022);
        const cool = Math.min(1, radius / 10);
        red = 1.0 - cool * .55;
        green = .63 + cool * .12;
        blue = .32 + cool * .68;
        size = .015 + Math.pow(random(), 4) * .065;
      } else if (kind === 0) {
        const azimuth = random() * Math.PI * 2;
        const elevation = Math.acos(2 * random() - 1);
        const distance = 90 + random() * 80;
        x = Math.cos(azimuth) * Math.sin(elevation) * distance;
        y = Math.sin(azimuth) * Math.sin(elevation) * distance;
        z = Math.cos(elevation) * distance;
        size = .09 + Math.pow(random(), 7) * .55;
      } else {
        x = (random() - .5) * 72;
        y = (random() - .5) * 52;
        z = random() * 60 - 35;
        size = .02 + Math.pow(random(), 4) * .07;
      }
      if (kind !== 1 && random() > .83) { red = 1; green = .76; blue = .46; }
      data.set([x, y, z, red, green, blue, size, random() * Math.PI * 2], i * 8);
    }
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) {
      gl.deleteVertexArray(vao); gl.deleteBuffer(buffer);
      throw new Error('WebGL star allocation failed');
    }
    const mesh = { vao, buffer, count };
    meshes.push(mesh);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (const [name, size, offset] of [['a_position', 3, 0], ['a_color', 3, 12], ['a_details', 2, 24]] as const) {
      const attribute = gl.getAttribLocation(starProgram!.program, name);
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 32, offset);
    }
    return mesh;
  }

  function releaseResources(deleteGpu = true) {
    if (deleteGpu && !gl.isContextLost()) {
      meshes.forEach(mesh => { gl.deleteVertexArray(mesh.vao); gl.deleteBuffer(mesh.buffer); });
      programs.forEach(program => gl.deleteProgram(program));
      if (screen) { gl.deleteVertexArray(screen.vao); gl.deleteBuffer(screen.buffer); }
      gl.deleteFramebuffer(volumeBuffer);
      gl.deleteTexture(volumeTexture);
      gl.deleteTexture(noise);
    }
    meshes.length = 0;
    programs.length = 0;
    screen = null;
    volumeBuffer = null;
    volumeTexture = null;
    compositeProgram = null;
    noise = null;
    starProgram = null;
    volumeProgram = null;
  }

  function initialize() {
    releaseResources();
    seed = 71421;
    starProgram = makeProgram(starVertex, starFragment);
    volumeProgram = makeProgram(volumeVertex, volumeFragment);
    compositeProgram = makeProgram(volumeVertex, compositeFragment);
    makeStars(0, 3200);
    makeStars(1, 26000);
    makeStars(2, 420);
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) {
      gl.deleteVertexArray(vao); gl.deleteBuffer(buffer);
      throw new Error('WebGL screen allocation failed');
    }
    screen = { vao, buffer, count: 3 };
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(volumeProgram.program, 'a_position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

    // 3D 노이즈를 한 번만 올려 성운의 다중 주파수 질감을 GPU에서 보간한다.
    const voxels = new Uint8Array(64 * 64 * 64);
    for (let i = 0; i < voxels.length; i++) voxels[i] = random() * 255;
    noise = gl.createTexture();
    if (!noise) throw new Error('WebGL volume allocation failed');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, noise);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 64, 64, 64, 0, gl.RED, gl.UNSIGNED_BYTE, voxels);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
    volumeBuffer = gl.createFramebuffer();
    volumeTexture = gl.createTexture();
    if (!volumeBuffer || !volumeTexture) throw new Error('WebGL framebuffer allocation failed');
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, volumeTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    resize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, volumeBuffer);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!complete) throw new Error('WebGL framebuffer unavailable');
    canvas.dataset.renderer = 'webgl';
    canvas.dataset.ready = 'true';
  }

  function uniforms(target: Program) {
    gl.useProgram(target.program);
    gl.uniform1f(target.uniforms.u_time, time);
    gl.uniform2f(target.uniforms.u_pointer, smoothX, smoothY);
    gl.uniform1f(target.uniforms.u_aspect, width / height);
    gl.uniform1f(target.uniforms.u_portrait, width <= 800 ? 1 : 0);
  }

  function render() {
    const [distant, galaxy, foreground] = meshes;
    if (!starProgram || !volumeProgram || !screen || !compositeProgram || !volumeBuffer || !distant || !galaxy || !foreground || gl.isContextLost()) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.clearColor(.006, .012, .026, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE);
    uniforms(starProgram);
    gl.uniform1f(starProgram.uniforms.u_height, canvas.height);
    gl.uniform1f(starProgram.uniforms.u_pixelRatio, ratio);
    for (const [kind, mesh] of [distant, galaxy].entries()) {
      gl.uniform1i(starProgram.uniforms.u_kind, kind);
      gl.bindVertexArray(mesh.vao);
      gl.drawArrays(gl.POINTS, 0, mesh.count);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, volumeBuffer);
    gl.viewport(0, 0, volumeWidth, volumeHeight);
    gl.disable(gl.BLEND);
    uniforms(volumeProgram);
    gl.uniform2f(volumeProgram.uniforms.u_resolution, volumeWidth, volumeHeight);
    gl.uniform1i(volumeProgram.uniforms.u_steps, width <= 800 || quality < .8 ? 28 : 40);
    gl.uniform1i(volumeProgram.uniforms.u_noise, 0);
    gl.bindVertexArray(screen.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(compositeProgram.program);
    gl.uniform1i(compositeProgram.uniforms.u_image, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // 가까운 별은 먼지에 가려지는 은하보다 앞에 있으므로 마지막에 그린다.
    uniforms(starProgram);
    gl.uniform1i(starProgram.uniforms.u_kind, 2);
    gl.bindVertexArray(foreground.vao);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, foreground.count);
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2000000 / (width * height)));
    const volumeRatio = Math.min(1, Math.sqrt((width <= 800 ? 85000 : 160000) / (width * height))) * quality;
    volumeWidth = Math.max(1, Math.round(width * volumeRatio));
    volumeHeight = Math.max(1, Math.round(height * volumeRatio));
    if (volumeTexture && volumeBuffer && !gl.isContextLost()) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, volumeTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, volumeWidth, volumeHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, volumeBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, volumeTexture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    render();
  }

  function animate(now: number) {
    frame = 0;
    if (paused || disposed || gl.isContextLost()) return;
    elapsed = now - lastFrame;
    if (elapsed >= 1000 / 30 - 1) {
      const delta = Math.min(elapsed / 1000, .1);
      time += delta;
      const easing = 1 - Math.exp(-delta * 2.5);
      smoothX += (pointerX - smoothX) * easing;
      smoothY += (pointerY - smoothY) * easing;
      lastFrame = now;
      // 느린 기기는 해상도와 광선 표본 수를 낮추고 입력 반응성을 먼저 지킨다.
      slowFrames = elapsed > 58 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 15 && quality > .55) {
        quality *= .82;
        slowFrames = 0;
        resize();
      } else render();
    }
    frame = requestAnimationFrame(animate);
  }

  function setPaused(next: boolean) {
    paused = next;
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = performance.now();
    if (!paused && !disposed && canvas.dataset.ready === 'true') frame = requestAnimationFrame(animate);
  }
  function onPointer(event: PointerEvent) {
    if (paused || event.pointerType !== 'mouse') return;
    pointerX = (event.clientX / window.innerWidth - .5) * 2;
    pointerY = (.5 - event.clientY / window.innerHeight) * 2;
  }
  function onLeave() { pointerX = 0; pointerY = 0; }
  function onLost(event: Event) {
    event.preventDefault();
    cancelAnimationFrame(frame);
    canvas.dataset.ready = 'false';
    canvas.dataset.renderer = 'fallback';
    // 컨텍스트를 잃으면 GPU가 이미 해제한 핸들을 새 컨텍스트에서 삭제하면 안 된다.
    releaseResources(false);
  }
  function recover() {
    try { initialize(); setPaused(paused); }
    catch (error) {
      canvas.dataset.ready = 'false';
      canvas.dataset.renderer = 'fallback';
      releaseResources();
      console.warn('우주 배경을 기본 이미지로 전환했습니다.', error);
    }
  }

  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', recover);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  const observer = new ResizeObserver(resize);
  recover();
  observer.observe(canvas);

  return {
    setPaused,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', recover);
      releaseResources();
      canvas.dataset.ready = 'false';
    },
  };
}
