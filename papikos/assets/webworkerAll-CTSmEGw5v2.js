import{M as k,h as M,aa as O,av as A,L as P,k as v,G as E,b as U,H as z,a5 as V,N as g,T as b,an as Y,R as q,w as L,t as R}from"./App-CU_U9YpBv2.js";import{F as W}from"./Filter-LkBJeSeYv2.js";import"./index-SvUl-92jv2.js";import"./activeKos-BKJUVzJ_v2.js";import"./cloud-6E2ijBN7v2.js";import"./ref-BxFHwI13v2.js";import"./friends-jWu9jMe9v2.js";import"./store-SGl8bGnMv2.js";import"./AccountBox-9db2FSoNv2.js";import"./sync-BbbZPr_5v2.js";import"./wallet-B3rhit0Hv2.js";import"./version-ptysXaZqv2.js";import"./sfx-CX5SepZIv2.js";const y=new k;function C(m,e){e.clear();const t=e.matrix;for(let r=0;r<m.length;r++){const i=m[r];if(i.globalDisplayStatus<7)continue;const s=i.renderGroup??i.parentRenderGroup;s!=null&&s.isCachedAsTexture?e.matrix=y.copyFrom(s.textureOffsetInverseTransform).append(i.worldTransform):s!=null&&s._parentCacheAsTextureRenderGroup?e.matrix=y.copyFrom(s._parentCacheAsTextureRenderGroup.inverseWorldTransform).append(i.groupTransform):e.matrix=i.worldTransform,e.addBounds(i.bounds)}return e.matrix=t,e}function S(m){return typeof m.getCanvasFilterString=="function"}class X{constructor(){this.skip=!1,this.useClip=!1,this.filters=null,this.container=null,this.bounds=new P,this.cssFilterString=""}}class G{constructor(e){this._filterStack=[],this._filterStackIndex=0,this._savedStates=[],this._alphaMultiplier=1,this._warnedFilterTypes=new Set,this.renderer=e}push(e){const t=this._pushFilterFrame(),r=e.filterEffect.filters;if(t.skip=!1,t.useClip=!1,t.filters=r,t.container=e.container,t.cssFilterString="",r.every(a=>!a.enabled)){t.skip=!0;return}const i=[],s=1;for(const a of r){if(!a.enabled)continue;if(!S(a)){this._warnUnsupportedFilter(a);continue}const l=a.getCanvasFilterString();if(l===null){this._warnUnsupportedFilter(a);continue}l&&i.push(l)}if(i.length===0&&s===1){t.skip=!0;return}t.cssFilterString=i.join(" "),this._calculateFilterArea(e,t.bounds),t.useClip=!!e.filterEffect.filterArea;const n=this.renderer.canvasContext.activeContext,o=n.filter||"none";if(this._savedStates.push({filter:o,alphaMultiplier:this._alphaMultiplier}),t.useClip&&Number.isFinite(t.bounds.width)&&Number.isFinite(t.bounds.height)&&t.bounds.width>0&&t.bounds.height>0){const a=this.renderer.canvasContext.activeResolution||1;n.save(),n.setTransform(1,0,0,1,0,0),n.beginPath(),n.rect(t.bounds.x*a,t.bounds.y*a,t.bounds.width*a,t.bounds.height*a),n.clip()}else t.useClip=!1;t.cssFilterString&&(n.filter=o!=="none"?`${o} ${t.cssFilterString}`:t.cssFilterString)}pop(){const e=this._popFilterFrame();if(e.skip)return;const t=this._savedStates.pop();if(!t)return;const r=this.renderer.canvasContext.activeContext;e.useClip?r.restore():r.filter=t.filter,this._alphaMultiplier=t.alphaMultiplier}generateFilteredTexture({texture:e,filters:t}){if(!(t!=null&&t.length)||t.every(d=>!d.enabled))return e;const r=[],i=1;for(const d of t){if(!d.enabled)continue;if(!S(d)){this._warnUnsupportedFilter(d);continue}const F=d.getCanvasFilterString();if(F===null){this._warnUnsupportedFilter(d);continue}F&&r.push(F)}if(r.length===0&&i===1)return e;const s=M.getCanvasSource(e);if(!s)return e;const n=e.frame,o=e.source._resolution??e.source.resolution??1,a=n.width,l=n.height,p=O.getOptimalCanvasAndContext(a,l,o),{canvas:c,context:u}=p;u.setTransform(1,0,0,1,0,0),u.clearRect(0,0,c.width,c.height),r.length&&(u.filter=r.join(" "));const f=n.x*o,T=n.y*o,h=a*o,_=l*o;return u.drawImage(s,f,T,h,_,0,0,h,_),u.filter="none",u.globalAlpha=1,A(c,a,l,o)}_calculateFilterArea(e,t){if(e.renderables?C(e.renderables,t):e.filterEffect.filterArea?(t.clear(),t.addRect(e.filterEffect.filterArea),t.applyMatrix(e.container.worldTransform)):e.container.getFastGlobalBounds(!0,t),e.container){const r=e.container.renderGroup||e.container.parentRenderGroup,i=r==null?void 0:r.cacheToLocalTransform;i&&t.applyMatrix(i)}}_warnUnsupportedFilter(e){var r;const t=((r=e==null?void 0:e.constructor)==null?void 0:r.name)||"Filter";this._warnedFilterTypes.has(t)||(this._warnedFilterTypes.add(t),console.warn(`CanvasRenderer: filter "${t}" is not supported in Canvas2D and will be skipped.`))}get alphaMultiplier(){return this._alphaMultiplier}_pushFilterFrame(){let e=this._filterStack[this._filterStackIndex];return e||(e=this._filterStack[this._filterStackIndex]=new X),this._filterStackIndex++,e}_popFilterFrame(){return this._filterStackIndex<=0?this._filterStack[0]:(this._filterStackIndex--,this._filterStack[this._filterStackIndex])}destroy(){this._filterStack=null,this._savedStates=null,this._warnedFilterTypes=null,this._alphaMultiplier=1}}G.extension={type:[v.CanvasSystem],name:"filter"};var N=`in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`,j=`in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
    finalColor = texture(uTexture, vTextureCoord);
}
`,w=`struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

@group(0) @binding(0) var <uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>
{
    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>
{
    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(
  @location(0) aPosition: vec2<f32>,
) -> VSOutput {
  return VSOutput(
   filterVertexPosition(aPosition),
   filterTextureCoord(aPosition)
  );
}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
) -> @location(0) vec4<f32> {
    return textureSample(uTexture, uSampler, uv);
}
`;class H extends W{constructor(){const e=E.from({vertex:{source:w,entryPoint:"mainVertex"},fragment:{source:w,entryPoint:"mainFragment"},name:"passthrough-filter"}),t=U.from({vertex:N,fragment:j,name:"passthrough-filter"});super({gpuProgram:e,glProgram:t})}}class I{constructor(e){this._renderer=e}push(e,t,r){this._renderer.renderPipes.batch.break(r),r.add({renderPipeId:"filter",canBundle:!1,action:"pushFilter",container:t,filterEffect:e})}pop(e,t,r){this._renderer.renderPipes.batch.break(r),r.add({renderPipeId:"filter",action:"popFilter",canBundle:!1})}execute(e){e.action==="pushFilter"?this._renderer.filter.push(e):e.action==="popFilter"&&this._renderer.filter.pop()}destroy(){this._renderer=null}}I.extension={type:[v.WebGLPipes,v.WebGPUPipes,v.CanvasPipes],name:"filter"};const $=new Y({attributes:{aPosition:{buffer:new Float32Array([0,0,1,0,1,1,0,1]),format:"float32x2",stride:2*4,offset:0}},indexBuffer:new Uint32Array([0,1,2,0,2,3])});class D{constructor(){this.skip=!1,this.inputTexture=null,this.backTexture=null,this.filters=null,this.bounds=new P,this.container=null,this.blendRequired=!1,this.outputRenderSurface=null,this.firstEnabledIndex=-1,this.lastEnabledIndex=-1}}class B{constructor(e){this._filterStackIndex=0,this._filterStack=[],this._filterGlobalUniforms=new z({uInputSize:{value:new Float32Array(4),type:"vec4<f32>"},uInputPixel:{value:new Float32Array(4),type:"vec4<f32>"},uInputClamp:{value:new Float32Array(4),type:"vec4<f32>"},uOutputFrame:{value:new Float32Array(4),type:"vec4<f32>"},uGlobalFrame:{value:new Float32Array(4),type:"vec4<f32>"},uOutputTexture:{value:new Float32Array(4),type:"vec4<f32>"}}),this._globalFilterBindGroup=new V({}),this.renderer=e}init(){g.on("evict",this._unbindPassTextures,this)}get activeBackTexture(){var e;return(e=this._activeFilterData)==null?void 0:e.backTexture}push(e){const t=this.renderer,r=e.filterEffect.filters,i=this._pushFilterData();i.skip=!1,i.filters=r,i.container=e.container,i.outputRenderSurface=t.renderTarget.renderSurface;const s=t.renderTarget.renderTarget.colorTexture.source,n=s.resolution,o=s.antialias;if(r.every(p=>!p.enabled)){i.skip=!0;return}const a=i.bounds;if(this._calculateFilterArea(e,a),this._calculateFilterBounds(i,t.renderTarget.rootViewPort,o,n,1),i.skip)return;const l=this._getPreviousFilterData();this._setupFilterTextures(i,a,t,l)}generateFilteredTexture({texture:e,filters:t}){if(t.every(p=>!p.enabled))return e;const r=this._pushFilterData();this._activeFilterData=r,r.skip=!1,r.filters=t;const i=e.source,s=i.resolution,n=i.antialias,o=r.bounds;if(o.clear(),o.addRect(e.frame),this._calculateFilterBounds(r,o.rectangle,n,s,0),r.skip)return this._popFilterData(),e;r.outputRenderSurface=g.getOptimalTexture({width:o.width,height:o.height,resolution:r.resolution,antialias:r.antialias}),r.backTexture=b.EMPTY,r.inputTexture=e,this.renderer.renderTarget.finishRenderPass(),this._applyFiltersToTexture(r,!0);const l=r.outputRenderSurface;return l.source.alphaMode="premultiplied-alpha",this._popFilterData(),l}pop(){const e=this.renderer,t=this._popFilterData();t.skip||(e.globalUniforms.pop(),e.renderTarget.finishRenderPass(),this._activeFilterData=t,this._applyFiltersToTexture(t,!1),t.blendRequired&&g.returnTexture(t.backTexture),g.returnTexture(t.inputTexture))}getBackTexture(e,t,r){const{_resolution:i,format:s}=e.colorTexture.source,n=g.getOptimalTexture({width:t.width,height:t.height,resolution:i,format:s});return this._copyBackTexture(e,n,t,r)}_copyBackTexture(e,t,r,i){const s=t.source._resolution;let n=r.minX,o=r.minY;i&&(n-=i.minX,o-=i.minY),n=Math.floor(n*s+1e-6),o=Math.floor(o*s+1e-6);const a=Math.min(Math.ceil(r.width*s),t.source.pixelWidth),l=Math.min(Math.ceil(r.height*s),t.source.pixelHeight);return this.renderer.renderTarget.copyToTexture(e,t,{x:n,y:o},{width:a,height:l},{x:0,y:0}),t}applyFilter(e,t,r,i){const s=this.renderer,n=this._activeFilterData,a=n.outputRenderSurface===r,l=this._findClosestFilterData(),p=l?l.inputTexture.source._resolution:s.renderTarget.rootRenderTarget.colorTexture.source._resolution;let c=0,u=0;a&&l&&(c=l.bounds.minX,u=l.bounds.minY),this._updateFilterUniforms(t,r,n,c,u,p,a,i);const f=e.enabled?e:this._getPassthroughFilter();this._setupBindGroupsAndRender(f,t,s)}calculateSpriteMatrix(e,t){const r=this._activeFilterData,i=e.set(r.inputTexture._source.width,0,0,r.inputTexture._source.height,r.bounds.minX,r.bounds.minY),s=t.worldTransform.copyTo(k.shared),n=t.renderGroup||t.parentRenderGroup;return n&&n.cacheToLocalTransform&&s.prepend(n.cacheToLocalTransform),s.invert(),i.prepend(s),i.scale(1/t.texture.orig.width,1/t.texture.orig.height),i.translate(t.anchor.x,t.anchor.y),i}destroy(){var e;(e=this._passthroughFilter)==null||e.destroy(!0),this._passthroughFilter=null,g.off("evict",this._unbindPassTextures,this),this._globalFilterBindGroup.destroy()}_unbindPassTextures(){const e=this._globalFilterBindGroup;e.setResource(b.EMPTY.source,1),e.setResource(b.EMPTY.source.style,2),e.setResource(b.EMPTY.source,3)}_getPassthroughFilter(){return this._passthroughFilter??(this._passthroughFilter=new H),this._passthroughFilter}_setupBindGroupsAndRender(e,t,r){if(r.renderPipes.uniformBatch){const i=r.renderPipes.uniformBatch.getUboResource(this._filterGlobalUniforms);this._globalFilterBindGroup.setResource(i,0)}else this._globalFilterBindGroup.setResource(this._filterGlobalUniforms,0);this._globalFilterBindGroup.setResource(t.source,1),this._globalFilterBindGroup.setResource(t.source.style,2),e.groups[0]=this._globalFilterBindGroup,r.encoder.draw({geometry:$,shader:e,state:e._state,topology:"triangle-list"}),r.type===q.WEBGL&&r.renderTarget.finishRenderPass()}_setupFilterTextures(e,t,r,i){if(e.backTexture=b.EMPTY,e.inputTexture=g.getOptimalTexture({width:t.width,height:t.height,resolution:e.resolution,antialias:e.antialias}),e.blendRequired){r.renderTarget.finishRenderPass();const s=r.renderTarget.getRenderTarget(e.outputRenderSurface),n=s.colorTexture.source,o=g.getAlignedTexture(e.inputTexture,n._resolution,n.format);e.backTexture=this._copyBackTexture(s,o,t,i==null?void 0:i.bounds)}r.renderTarget.bind({target:e.inputTexture,clear:!0}),r.globalUniforms.push({offset:t})}_updateFilterUniforms(e,t,r,i,s,n,o,a){const l=this._filterGlobalUniforms.uniforms,p=l.uOutputFrame,c=l.uInputSize,u=l.uInputPixel,f=l.uInputClamp,T=l.uGlobalFrame,h=l.uOutputTexture;o?(p[0]=r.bounds.minX-i,p[1]=r.bounds.minY-s):(p[0]=0,p[1]=0),p[2]=e.frame.width,p[3]=e.frame.height,c[0]=e.source.width,c[1]=e.source.height,c[2]=1/c[0],c[3]=1/c[1],u[0]=e.source.pixelWidth,u[1]=e.source.pixelHeight,u[2]=1/u[0],u[3]=1/u[1],f[0]=.5*u[2],f[1]=.5*u[3],f[2]=e.frame.width*c[2]-.5*u[2],f[3]=e.frame.height*c[3]-.5*u[3];const _=this.renderer.renderTarget.rootRenderTarget.colorTexture;T[0]=i*n,T[1]=s*n,T[2]=_.source.width*n,T[3]=_.source.height*n,t instanceof b&&(t.source.resource=null);const d=this.renderer.renderTarget.getRenderTarget(t);this.renderer.renderTarget.bind({target:t,clear:!!a}),t instanceof b?(h[0]=t.frame.width,h[1]=t.frame.height):(h[0]=d.width,h[1]=d.height),h[2]=d.isRoot?-1:1,this._filterGlobalUniforms.update()}_findClosestFilterData(){for(let e=this._filterStackIndex-1;e>=0;e--){const t=this._filterStack[e];if(!t.skip)return t}return null}_calculateFilterArea(e,t){if(e.renderables?C(e.renderables,t):e.filterEffect.filterArea?(t.clear(),t.addRect(e.filterEffect.filterArea),t.applyMatrix(e.container.worldTransform)):e.container.getFastGlobalBounds(!0,t),e.container){const i=(e.container.renderGroup||e.container.parentRenderGroup).cacheToLocalTransform;i&&t.applyMatrix(i)}}_applyFiltersToTexture(e,t){const r=e.inputTexture,i=e.bounds,s=e.filters,n=e.firstEnabledIndex,o=e.lastEnabledIndex;if(this._globalFilterBindGroup.setResource(r.source.style,2),this._globalFilterBindGroup.setResource(e.backTexture.source,3),n===o)s[n].apply(this,r,e.outputRenderSurface,t);else{let a=e.inputTexture;const l=g.getOptimalTexture({width:i.width,height:i.height,resolution:a.source._resolution});let p=l;for(let c=n;c<o;c++){const u=s[c];if(!u.enabled)continue;u.apply(this,a,p,!0);const f=a;a=p,p=f}s[o].apply(this,a,e.outputRenderSurface,t),g.returnTexture(l)}}_calculateFilterBounds(e,t,r,i,s){var d;const n=this.renderer,o=e.bounds,a=e.filters;let l=1/0,p=0,c=!0,u=!1,f=!1,T=!0,h=-1,_=-1;for(let F=0;F<a.length;F++){const x=a[F];if(!x.enabled)continue;if(h===-1&&(h=F),_=F,l=Math.min(l,x.resolution==="inherit"?i:x.resolution),p+=x.padding,x.antialias==="off"?c=!1:x.antialias==="inherit"&&c&&(c=r),x.clipToViewport||(T=!1),!!!(x.compatibleRenderers&n.type)){f=!1;break}if(x.blendRequired&&!(((d=n.backBuffer)==null?void 0:d.useBackBuffer)??!0)){L("Blend filter requires backBuffer on WebGL renderer to be enabled. Set `useBackBuffer: true` in the renderer options."),f=!1;break}f=!0,u||(u=x.blendRequired)}if(!f){e.skip=!0;return}if(T&&o.fitBounds(0,t.width/i,0,t.height/i),o.scale(l).ceil().scale(1/l).pad((p|0)*s),!o.isPositive){e.skip=!0;return}e.antialias=c,e.resolution=l,e.blendRequired=u,e.firstEnabledIndex=h,e.lastEnabledIndex=_}_popFilterData(){return this._filterStackIndex--,this._filterStack[this._filterStackIndex]}_getPreviousFilterData(){for(let e=this._filterStackIndex-2;e>=0;e--){const t=this._filterStack[e];if(!t.skip)return t}return null}_pushFilterData(){let e=this._filterStack[this._filterStackIndex];return e||(e=this._filterStack[this._filterStackIndex]=new D),this._filterStackIndex++,e}}B.extension={type:[v.WebGLSystem,v.WebGPUSystem],name:"filter"};R.add(B,G);R.add(I);
