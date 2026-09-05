import { PLANET_SURFACES, type UniverseGraph, type Vec3 } from './universe-model';
import { planetVertex, planetFragment, lineVertex, lineFragment, skyVertex, skyFragment } from './planet-shaders';

export type PlanetProjection = { id: string; x: number; y: number; radius: number; depth: number; visible: boolean };
export type PlanetRenderer = {
  setGraph: (graph: UniverseGraph) => void;
  select: (id: string | null) => void;
  zoom: (factor: number) => void;
  reset: () => void;
  focus: (id: string) => void;
  setMotion: (enabled: boolean) => void;
  setConnections: (enabled: boolean) => void;
  dispose: () => void;
};
const uniforms = ['u_eye','u_basis','u_aspect','u_center','u_radius','u_spin','u_ring','u_maps','u_tint','u_surface','u_loaded','u_clouds','u_time','u_halo','u_selected','u_color','u_sky'] as const;
type Program = { object: WebGLProgram; locations: Record<typeof uniforms[number], WebGLUniformLocation | null> };
type Mesh = { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; index?: WebGLBuffer; count: number };
const norm = (p: Vec3): Vec3 => { const d=Math.hypot(...p)||1; return [p[0]/d,p[1]/d,p[2]/d]; };
const cross = (a: Vec3,b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a: Vec3,b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const rgb = (hex: string): Vec3 => [parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255];

export function createPlanetRenderer(canvas: HTMLCanvasElement, onProject: (points: PlanetProjection[], zoom: number) => void): PlanetRenderer {
  const stage=canvas.parentElement!;
  let context: WebGL2RenderingContext | null=null;
  try { context=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'low-power'}); } catch { /* GPU 차단은 경험 검색까지 막지 않는다. */ }
  const noop=()=>{};
  if(!context) {
    stage.dataset.renderer='fallback';
    return {setGraph:noop,select:noop,zoom:noop,reset:noop,focus:noop,setMotion:noop,setConnections:noop,dispose:noop};
  }
  const gl=context;
  let sourceGraph: UniverseGraph={planets:[],connections:[]};
  let graph: UniverseGraph={planets:[],connections:[]};
  let selected: string | null=null;
  let yaw=.12,pitch=.18,zoom=1,baseDistance=34,target: Vec3=[0,0,0];
  let width=1,height=1,eye: Vec3=[0,0,34],right: Vec3=[1,0,0],up: Vec3=[0,1,0],forward: Vec3=[0,0,-1];
  let basis=new Float32Array(9);
  let motion=false,connections=true,visible=document.visibilityState==='visible',disposed=false,lost=false;
  let frame=0,lastFrame=0,time=0,dirty=true;
  let planetProgram: Program | null=null,lineProgram: Program | null=null,skyProgram: Program | null=null;
  let sphere: Mesh | null=null,ring: Mesh | null=null,line: Mesh | null=null,sky: Mesh | null=null;
  let maps: WebGLTexture | null=null,skyMap: WebGLTexture | null=null;
  let loaded=new Float32Array(10),skyLoaded=false;
  let abort=new AbortController();
  const programs: Program[]=[],meshes: Mesh[]=[];
  const pointers=new Map<number,{x:number;y:number}>();
  let pinchDistance=0;

  function makeProgram(vertex: string,fragment: string): Program {
    const object=gl.createProgram();
    if(!object)throw new Error('Program allocation failed');
    const shaders: WebGLShader[]=[];
    try {
      for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const) {
        const shader=gl.createShader(type);if(!shader)throw new Error('Shader allocation failed');
        shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);gl.attachShader(object,shader);
      }
      gl.linkProgram(object);
      if(!gl.getProgramParameter(object,gl.LINK_STATUS))throw new Error(shaders.map(s=>gl.getShaderInfoLog(s)).join('\n'));
    } catch(error) {gl.deleteProgram(object);throw error;} finally {shaders.forEach(s=>gl.deleteShader(s));}
    const program={object,locations:Object.fromEntries(uniforms.map(name=>[name,gl.getUniformLocation(object,name)])) as Program['locations']};
    programs.push(program);return program;
  }
  function makeMesh(vertices: number[],indices?: number[],stride=3): Mesh {
    const vao=gl.createVertexArray(),buffer=gl.createBuffer(),index=indices?gl.createBuffer():null;
    if(!vao||!buffer||(indices&&!index)){gl.deleteVertexArray(vao);gl.deleteBuffer(buffer);gl.deleteBuffer(index);throw new Error('Mesh allocation failed');}
    const mesh={vao,buffer,index:index??undefined,count:indices?.length??vertices.length/stride};
    meshes.push(mesh);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,stride===2?2:3,gl.FLOAT,false,stride*4,0);
    if(stride===5){gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);}
    if(index&&indices){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);}
    return mesh;
  }
  async function loadMap(file: string,index: number,generation: AbortController) {
    let bitmap: ImageBitmap | null=null;
    try {
      const response=await fetch(`/assets/planets/${file}.webp`,{signal:generation.signal});
      if(!response.ok)throw new Error('Texture unavailable');
      bitmap=await createImageBitmap(await response.blob(),{imageOrientation:'flipY'});
      if(disposed||lost||generation.signal.aborted)return;
      if(index<10){
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,maps);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,index,1024,512,1,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
        loaded[index]=1;
      } else {
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,skyMap);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);skyLoaded=true;
      }
      invalidate();
    } catch { /* 텍스처가 없어도 색·조명과 클릭 가능한 태그는 유지한다. */ }
    finally {bitmap?.close();}
  }
  function release(deleteGpu=true) {
    abort.abort();
    if(deleteGpu&&!gl.isContextLost()) {
      programs.forEach(p=>gl.deleteProgram(p.object));
      meshes.forEach(m=>{gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.buffer);if(m.index)gl.deleteBuffer(m.index);});
      gl.deleteTexture(maps);gl.deleteTexture(skyMap);
    }
    programs.length=0;meshes.length=0;
    planetProgram=null;lineProgram=null;skyProgram=null;sphere=null;ring=null;line=null;sky=null;maps=null;skyMap=null;
    loaded=new Float32Array(10);skyLoaded=false;
  }
  function initialize() {
    release();abort=new AbortController();
    planetProgram=makeProgram(planetVertex,planetFragment);lineProgram=makeProgram(lineVertex,lineFragment);skyProgram=makeProgram(skyVertex,skyFragment);
    const vertices:number[]=[],indices:number[]=[];
    for(let lat=0;lat<=32;lat++)for(let lon=0;lon<=64;lon++) {
      const theta=lat/32*Math.PI,phi=lon/64*Math.PI*2;
      vertices.push(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi),lon/64,1-lat/32);
      if(lat<32&&lon<64){const a=lat*65+lon;indices.push(a,a+65,a+1,a+1,a+65,a+66);}
    }
    sphere=makeMesh(vertices,indices,5);
    const ringVertices:number[]=[],ringIndices:number[]=[];
    for(let i=0;i<=96;i++)for(let edge=0;edge<2;edge++) {
      const a=i/96*Math.PI*2,r=edge?2.1:1.25;ringVertices.push(Math.cos(a)*r,0,Math.sin(a)*r,edge,i/96);
      if(i<96&&edge===0){const j=i*2;ringIndices.push(j,j+1,j+2,j+1,j+3,j+2);}
    }
    ring=makeMesh(ringVertices,ringIndices,5);line=makeMesh([]);sky=makeMesh([-1,-1,3,-1,-1,3],undefined,2);
    maps=gl.createTexture();skyMap=gl.createTexture();if(!maps||!skyMap)throw new Error('Texture allocation failed');
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,maps);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.RGBA8,1024,512,10);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,skyMap);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([8,14,24,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    [...PLANET_SURFACES.map(s=>s.file),'sun','clouds','milky-way'].forEach((file,index)=>{void loadMap(file,index,abort);});
    stage.dataset.renderer='webgl';resize();
  }
  function camera() {
    const distance=baseDistance/zoom;
    eye=[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
    forward=norm([target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]]);right=norm(cross(forward,[0,1,0]));up=cross(right,forward);
    basis=new Float32Array([...right,...up,...forward]);
  }
  function setProgram(program: Program) {
    gl.useProgram(program.object);gl.uniform3fv(program.locations.u_eye,eye);gl.uniformMatrix3fv(program.locations.u_basis,false,basis);gl.uniform1f(program.locations.u_aspect,width/height);
  }
  function drawLine(points: number[],color: [number,number,number,number]) {
    if(!line||!lineProgram||!points.length)return;
    setProgram(lineProgram);gl.uniform4fv(lineProgram.locations.u_color,color);gl.bindVertexArray(line.vao);gl.bindBuffer(gl.ARRAY_BUFFER,line.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.DYNAMIC_DRAW);gl.drawArrays(gl.LINES,0,points.length/3);
  }
  function drawPlanet(position: Vec3,radius: number,surface: number,tint: Vec3,highlight:boolean) {
    if(!planetProgram||!sphere||!ring)return;
    setProgram(planetProgram);const u=planetProgram.locations;
    gl.uniform1i(u.u_maps,0);gl.uniform3fv(u.u_center,position);gl.uniform3fv(u.u_tint,tint);gl.uniform1f(u.u_surface,surface);
    gl.uniform1f(u.u_loaded,loaded[surface]??0);gl.uniform1f(u.u_clouds,loaded[9]??0);gl.uniform1f(u.u_time,time);
    gl.uniform1f(u.u_spin,time*.08+surface*.8);gl.uniform1f(u.u_selected,highlight?1:0);gl.uniform1f(u.u_radius,radius);
    gl.uniform1f(u.u_halo,0);gl.uniform1f(u.u_ring,0);gl.disable(gl.BLEND);gl.depthMask(true);
    gl.bindVertexArray(sphere.vao);gl.drawElements(gl.TRIANGLES,sphere.count,gl.UNSIGNED_SHORT,0);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    if(surface===3) {gl.uniform1f(u.u_ring,1);gl.bindVertexArray(ring.vao);gl.drawElements(gl.TRIANGLES,ring.count,gl.UNSIGNED_SHORT,0);gl.uniform1f(u.u_ring,0);}
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.uniform1f(u.u_halo,1);gl.uniform1f(u.u_radius,radius*(surface===8?1.36:1.055));
    gl.bindVertexArray(sphere.vao);gl.drawElements(gl.TRIANGLES,sphere.count,gl.UNSIGNED_SHORT,0);gl.depthMask(true);
  }
  function project(id: string,position: Vec3,radius: number): PlanetProjection {
    const relative:Vec3=[position[0]-eye[0],position[1]-eye[1],position[2]-eye[2]],depth=dot(relative,forward);
    const scale=height*.95/Math.max(depth,.1),x=width/2+dot(relative,right)*scale,y=height/2-dot(relative,up)*scale;
    return {id,x,y,depth,radius:radius*scale,visible:depth>.5&&x>-80&&x<width+80&&y>-80&&y<height+80};
  }
  function render() {
    if(disposed||lost||!sky||!skyProgram||!planetProgram)return;
    camera();gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.02,.03,.05,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);setProgram(skyProgram);gl.uniform1i(skyProgram.locations.u_sky,1);gl.uniform1f(skyProgram.locations.u_loaded,skyLoaded?1:0);
    gl.bindVertexArray(sky.vao);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    const guide:number[]=[];
    for(const r of [5.2,10.5,16.2])for(let i=0;i<160;i++){const a=i/160*Math.PI*2,b=(i+1)/160*Math.PI*2;guide.push(Math.cos(a)*r,Math.sin(a)*r,-4,Math.cos(b)*r,Math.sin(b)*r,-4);}
    drawLine(guide,[.33,.46,.62,.13]);
    if(connections) {
      const lookup=new Map(graph.planets.map(p=>[p.id,p]));
      const normal:number[]=[],active:number[]=[];
      const edges=[...graph.connections].sort((a,b)=>Number(b.from===selected||b.to===selected)-Number(a.from===selected||a.to===selected)).slice(0,900);
      for(const edge of edges) {
        const a=lookup.get(edge.from),b=lookup.get(edge.to);if(!a||!b)continue;
        const output=edge.from===selected||edge.to===selected?active:normal;
        for(let i=0;i<16;i++)for(const t of [i/16,(i+1)/16])output.push(a.position[0]+(b.position[0]-a.position[0])*t,a.position[1]+(b.position[1]-a.position[1])*t,a.position[2]+(b.position[2]-a.position[2])*t-Math.sin(t*Math.PI)*1.6);
      }
      drawLine(normal,[.32,.64,.77,selected ? .09 : .25]);drawLine(active,[.98,.7,.38,.8]);
    }
    gl.depthMask(true);
    drawPlanet([0,0,0],1.5,8,[1,.59,.2],selected===null);
    for(const planet of graph.planets)drawPlanet(planet.position,planet.radius,planet.surface,rgb(planet.color),planet.id===selected);
    onProject([project('core',[0,0,0],1.5),...graph.planets.map(p=>project(p.id,p.position,p.radius))],zoom);
    dirty=false;
  }
  function tick(now:number) {
    frame=0;if(disposed||lost||!visible)return;
    if(dirty||(motion&&now-lastFrame>=1000/30-1)) {if(motion)time+=Math.min((now-lastFrame)/1000,.08);lastFrame=now;render();}
    if(motion)frame=requestAnimationFrame(tick);
  }
  function invalidate() {dirty=true;if(!frame&&!disposed&&!lost&&visible)frame=requestAnimationFrame(tick);}
  function fit() {
    // 세로 화면에서는 태그를 세로로 펼쳐 작은 원 안에 라벨이 겹치지 않게 한다.
    const stretch=Math.min(1,Math.sqrt(width/height/1.4));
    graph={...sourceGraph,planets:sourceGraph.planets.map(p=>({...p,position:[p.position[0]*stretch,p.position[1]/stretch,p.position[2]] as Vec3}))};
    const extent=graph.planets.reduce((bounds,p)=>[Math.max(bounds[0]!,Math.abs(p.position[0])+3),Math.max(bounds[1]!,Math.abs(p.position[1])+3)],[12,10]);
    const padding=width<600?2.6:2.25;
    baseDistance=Math.max(27,Math.max(extent[0]!/(width/height),extent[1]!)*padding);
  }
  function resize() {
    width=Math.max(1,canvas.clientWidth);height=Math.max(1,canvas.clientHeight);
    const ratio=Math.min(window.devicePixelRatio||1,1.6,Math.sqrt(2400000/(width*height)));
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);fit();invalidate();
  }
  function changeZoom(factor:number) {zoom=Math.max(.45,Math.min(4,zoom*factor));invalidate();}
  function reset() {yaw=.12;pitch=.18;zoom=1;target=[0,0,0];invalidate();}
  function down(event:PointerEvent) {
    if(stage.dataset.renderer!=='webgl')return;
    if((event.target as HTMLElement).closest('button,a,input'))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});stage.setPointerCapture(event.pointerId);
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a!.x-b!.x,a!.y-b!.y);}
    stage.dataset.dragging='true';
  }
  function move(event:PointerEvent) {
    const old=pointers.get(event.pointerId);if(!old)return;
    const dx=event.clientX-old.x,dy=event.clientY-old.y;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()];const distance=Math.hypot(a!.x-b!.x,a!.y-b!.y);if(pinchDistance>0)changeZoom(distance/pinchDistance);pinchDistance=distance;}
    else if(event.shiftKey||(event.buttons & 2) !== 0){const scale=baseDistance/zoom/height;target=[target[0]-dx*scale,target[1]+dy*scale,target[2]];}
    else {yaw-=dx*.005;pitch=Math.max(-1.18,Math.min(1.18,pitch+dy*.005));}
    invalidate();
  }
  function end(event:PointerEvent) {pointers.delete(event.pointerId);if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);if(!pointers.size)stage.dataset.dragging='false';pinchDistance=0;}
  function wheel(event:WheelEvent) {if(stage.dataset.renderer!=='webgl')return;event.preventDefault();changeZoom(Math.exp(-event.deltaY*(event.deltaMode === 1 ? .025 : .0015)));}
  function key(event:KeyboardEvent) {
    if(event.target!==stage)return;
    if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))event.preventDefault();
    if(event.key==='+'||event.key==='=')changeZoom(1.2);if(event.key==='-')changeZoom(1/1.2);if(event.key==='Home')reset();
    if(event.key==='ArrowLeft')yaw+=.12;if(event.key==='ArrowRight')yaw-=.12;
    if(event.key==='ArrowUp')pitch=Math.min(1.18,pitch+.1);if(event.key==='ArrowDown')pitch=Math.max(-1.18,pitch-.1);invalidate();
  }
  function visibility() {visible=document.visibilityState==='visible';cancelAnimationFrame(frame);frame=0;lastFrame=performance.now();if(visible)invalidate();}
  function onLost(event:Event) {event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;stage.dataset.renderer='fallback';release(false);}
  function recover() {lost=false;try{initialize();invalidate();}catch(error){release();stage.dataset.renderer='fallback';console.warn('행성 지도를 목록으로 전환했습니다.',error);}}
  stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);stage.addEventListener('lostpointercapture',end);
  stage.addEventListener('wheel',wheel,{passive:false});stage.addEventListener('keydown',key);
  canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',recover);document.addEventListener('visibilitychange',visibility);
  const observer=new ResizeObserver(resize);recover();observer.observe(canvas);
  return {
    setGraph(next){sourceGraph=next;fit();reset();},select(id){selected=id;invalidate();},zoom:changeZoom,reset,
    focus(id){const p=graph.planets.find(p=>p.id===id);if(p){target=[...p.position];zoom=Math.min(3.4,Math.max(1.6,zoom));invalidate();}},
    setMotion(enabled){motion=enabled;lastFrame=performance.now();invalidate();},setConnections(enabled){connections=enabled;invalidate();},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();release();
      stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',end);stage.removeEventListener('pointercancel',end);stage.removeEventListener('lostpointercapture',end);
      stage.removeEventListener('wheel',wheel);stage.removeEventListener('keydown',key);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',recover);document.removeEventListener('visibilitychange',visibility);
    },
  };
}
