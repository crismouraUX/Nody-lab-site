/* ===========================================================================
   NODY/LAB — shared runtime (classic script; works over file://).
   Requires globals: THREE (r128 UMD), gsap, ScrollTrigger.
   Every feature is guarded by element presence, so one file drives all pages.
   =========================================================================== */
(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";
  function el(t,a){ var e=document.createElementNS(NS,t); for(var k in a) e.setAttribute(k,a[k]); return e; }
  function rand(a,b){ return a+Math.random()*(b-a); }

  /* -------- Three.js living shader tile (hero) --------
     A esfera ruidosa continua sendo a base. As outras formas são campos de
     distância (SDF) e os vértices da esfera são relaxados sobre a superfície
     de cada uma. O ruído continua sendo amostrado no domínio da NORMAL DA
     ESFERA, então cor, textura e movimento não mudam de forma para forma —
     só a silhueta muda. Cada página escolhe seu ciclo por data-shapes. */
  (function three(){
    var tile = document.getElementById("showtile");
    var canvas = document.getElementById("glcanvas");
    if(!tile || !canvas || typeof THREE === "undefined") return;

    /* ---------- helpers de SDF ---------- */
    function len3(x,y,z){ return Math.sqrt(x*x+y*y+z*z); }
    function smin(a,b,k){ var h=Math.max(0,Math.min(1,0.5+0.5*(b-a)/k)); return b*(1-h)+a*h-k*h*(1-h); }
    function sdSphere(x,y,z,r){ return len3(x,y,z)-r; }
    function sdEllipsoid(x,y,z,rx,ry,rz){
      var k0=len3(x/rx,y/ry,z/rz), k1=len3(x/(rx*rx),y/(ry*ry),z/(rz*rz));
      return k1<1e-8 ? -Math.min(rx,ry,rz) : k0*(k0-1.0)/k1;
    }
    function sdRoundBox(x,y,z,bx,by,bz,r){
      var qx=Math.abs(x)-bx, qy=Math.abs(y)-by, qz=Math.abs(z)-bz;
      return len3(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))
           + Math.min(Math.max(qx,Math.max(qy,qz)),0) - r;
    }
    function sdCapsule(px,py,pz,ax,ay,az,bx,by,bz,r){
      var pax=px-ax,pay=py-ay,paz=pz-az, bax=bx-ax,bay=by-ay,baz=bz-az;
      var dd=bax*bax+bay*bay+baz*baz;
      var h=dd<1e-8?0:Math.max(0,Math.min(1,(pax*bax+pay*bay+paz*baz)/dd));
      return len3(pax-bax*h,pay-bay*h,paz-baz*h)-r;
    }
    /* tronco cônico aproximado por esferas — usado em raízes e na ponta do coração */
    function sdTaper(px,py,pz,ax,ay,az,bx,by,bz,r1,r2,n){
      var d=1e9;
      for(var i=0;i<=n;i++){
        var t=i/n;
        var sx=ax+(bx-ax)*t, sy=ay+(by-ay)*t, sz=az+(bz-az)*t;
        d=Math.min(d, sdSphere(px-sx,py-sy,pz-sz, r1+(r2-r1)*t));
      }
      return d;
    }

    /* ---------- as formas ---------- */
    var SDF = {
      orb: function(x,y,z){ return len3(x,y,z)-1.0; },

      brain: function(x,y,z){
        var d = sdEllipsoid(x, y-0.04, z, 0.95, 0.80, 1.00);
        d = Math.max(d, -sdRoundBox(x, y-0.62, z, 0.05, 0.62, 0.80, 0.02));   // fissura sagital
        d = smin(d, sdEllipsoid(x, y+0.52, z+0.46, 0.44, 0.25, 0.30), 0.14);  // cerebelo
        d = smin(d, sdTaper(x,y,z, 0,-0.48,0.12, 0,-1.00,0.22, 0.15,0.10, 5), 0.12); // tronco
        d += 0.032*Math.sin(7.0*x)*Math.sin(7.0*y+1.0)*Math.sin(7.0*z);       // giros
        d += 0.016*Math.sin(13.0*x+0.5)*Math.sin(13.0*z+1.7);
        return d;
      },

      tooth: function(x,y,z){
        var d = sdRoundBox(x, y-0.40, z, 0.36, 0.24, 0.32, 0.17);             // coroa
        d = smin(d, sdSphere(x-0.23,y-0.70,z-0.19,0.15), 0.11);               // cúspides
        d = smin(d, sdSphere(x+0.23,y-0.70,z-0.19,0.15), 0.11);
        d = smin(d, sdSphere(x-0.23,y-0.70,z+0.19,0.15), 0.11);
        d = smin(d, sdSphere(x+0.23,y-0.70,z+0.19,0.15), 0.11);
        d = smin(d, sdTaper(x,y,z, -0.20,0.10,0, -0.30,-0.98,0, 0.15,0.045,7), 0.13); // raízes
        d = smin(d, sdTaper(x,y,z,  0.20,0.10,0,  0.30,-0.98,0, 0.15,0.045,7), 0.13);
        return d;
      },

      heart: function(x,y,z){
        var zz = z*1.45;                                                       // achatado
        var d = sdSphere(x-0.29, y-0.30, zz, 0.43);
        d = smin(d, sdSphere(x+0.29, y-0.30, zz, 0.43), 0.20);
        d = smin(d, sdTaper(x,y,zz, 0,0.10,0, 0,-1.00,0, 0.56,0.03, 9), 0.26); // ponta
        return d;
      },

      scale: function(x,y,z){
        var d = sdCapsule(x,y,z, 0,-0.70,0, 0,0.68,0, 0.065);                 // poste
        d = Math.min(d, sdRoundBox(x, y+0.80, z, 0.32,0.05,0.32, 0.04));      // base
        d = Math.min(d, sdCapsule(x,y,z, -0.74,0.58,0, 0.74,0.58,0, 0.052));  // travessa
        d = Math.min(d, sdSphere(x, y-0.76, z, 0.09));                        // pomo
        for(var s=-1;s<=1;s+=2){
          var px=0.74*s;
          d = Math.min(d, sdCapsule(x,y,z, px,0.56,0, px,0.22,0, 0.022));     // hastes
          d = Math.min(d, sdEllipsoid(x-px, y-0.16, z, 0.27,0.055,0.27));     // pratos
        }
        return d;
      },

      screen: function(x,y,z){
        var d = sdRoundBox(x, y-0.18, z, 0.84, 0.52, 0.05, 0.06);             // painel
        d = Math.min(d, sdRoundBox(x, y+0.52, z, 0.09, 0.22, 0.06, 0.03));    // pescoço
        d = Math.min(d, sdRoundBox(x, y+0.76, z, 0.38, 0.045, 0.19, 0.03));   // base
        return d;
      }
    };

    /* ---------- geometria base ---------- */
    var DETAIL = 16;
    var geo = new THREE.IcosahedronGeometry(1, DETAIL);
    var basePos = geo.attributes.position.array;
    var baseNrm = geo.attributes.normal.array;
    var VCOUNT  = geo.attributes.position.count;

    /* projeta cada vértice da esfera na superfície do SDF (descida de gradiente) */
    function buildShape(sdf, from, to, out){
      var e = 0.0016;
      for(var i=from;i<to;i++){
        var o=i*3, px=baseNrm[o]*1.65, py=baseNrm[o+1]*1.65, pz=baseNrm[o+2]*1.65;
        var gx=baseNrm[o], gy=baseNrm[o+1], gz=baseNrm[o+2];
        for(var k=0;k<16;k++){
          var d = sdf(px,py,pz);
          gx = sdf(px+e,py,pz)-d; gy = sdf(px,py+e,pz)-d; gz = sdf(px,py,pz+e)-d;
          var gl = len3(gx,gy,gz) || 1e-6; gx/=gl; gy/=gl; gz/=gl;
          if(Math.abs(d) < 0.0009) break;
          px -= gx*d*0.92; py -= gy*d*0.92; pz -= gz*d*0.92;
        }
        out.pos[o]=px; out.pos[o+1]=py; out.pos[o+2]=pz;
        out.nrm[o]=gx; out.nrm[o+1]=gy; out.nrm[o+2]=gz;
      }
    }

    /* normaliza a escala para todas as formas ocuparem o mesmo espaço visual */
    function fitShape(s){
      var m=0, i;
      for(i=0;i<s.pos.length;i+=3){ var r=len3(s.pos[i],s.pos[i+1],s.pos[i+2]); if(r>m) m=r; }
      if(m<1e-6) return;
      var k=1.16/m;
      for(i=0;i<s.pos.length;i++) s.pos[i]*=k;
    }

    var cache = {};
    function shapeSync(name){                       // usado só para o orb (barato)
      if(cache[name]) return cache[name];
      var s={pos:new Float32Array(VCOUNT*3), nrm:new Float32Array(VCOUNT*3), done:true};
      buildShape(SDF[name]||SDF.orb, 0, VCOUNT, s); fitShape(s); cache[name]=s; return s;
    }

    /* construção fatiada: nunca trava a thread principal */
    var queue=[], building=null, buildAt=0, CHUNK=1400;
    function requestShape(name){
      if(cache[name] || name==="orb") return;
      if(queue.indexOf(name)<0) queue.push(name);
    }
    function pumpBuild(){
      if(!building){
        if(!queue.length) return;
        var n=queue.shift();
        if(cache[n]) return;
        building={name:n, s:{pos:new Float32Array(VCOUNT*3), nrm:new Float32Array(VCOUNT*3), done:false}};
        buildAt=0;
      }
      var end=Math.min(buildAt+CHUNK, VCOUNT);
      buildShape(SDF[building.name]||SDF.orb, buildAt, end, building.s);
      buildAt=end;
      if(buildAt>=VCOUNT){ fitShape(building.s); building.s.done=true; cache[building.name]=building.s; building=null; }
    }

    /* ---------- ciclo de formas da página ---------- */
    var cycle = (tile.getAttribute("data-shapes")||"orb").split(",")
                  .map(function(s){return s.trim();})
                  .filter(function(s){return !!SDF[s];});
    if(!cycle.length) cycle=["orb"];
    var orb = shapeSync("orb");
    for(var q=0;q<cycle.length;q++) requestShape(cycle[q]);

    /* ---------- render ---------- */
    var renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 3.4;

    var aPosA=new THREE.BufferAttribute(new Float32Array(orb.pos),3);
    var aNrmA=new THREE.BufferAttribute(new Float32Array(orb.nrm),3);
    var aPosB=new THREE.BufferAttribute(new Float32Array(orb.pos),3);
    var aNrmB=new THREE.BufferAttribute(new Float32Array(orb.nrm),3);
    aPosA.setUsage(THREE.DynamicDrawUsage); aNrmA.setUsage(THREE.DynamicDrawUsage);
    aPosB.setUsage(THREE.DynamicDrawUsage); aNrmB.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aPosA",aPosA); geo.setAttribute("aNrmA",aNrmA);
    geo.setAttribute("aPosB",aPosB); geo.setAttribute("aNrmB",aNrmB);

    var uniforms = { uTime:{value:0}, uMouse:{value:new THREE.Vector2(0,0)}, uMix:{value:0},
      cA:{value:new THREE.Color(0x6a4cf5)}, cB:{value:new THREE.Color(0xd44df0)}, cC:{value:new THREE.Color(0xff7a3d)} };
    var mat = new THREE.ShaderMaterial({ uniforms:uniforms,
      vertexShader:[
        "uniform float uTime; uniform vec2 uMouse; uniform float uMix;",
        "attribute vec3 aPosA; attribute vec3 aNrmA; attribute vec3 aPosB; attribute vec3 aNrmB;",
        "varying vec3 vNormal; varying float vD;",
        "vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}",
        "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
        "float snoise(vec3 v){",
        "  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);",
        "  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);",
        "  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);",
        "  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod(i,289.0);",
        "  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
        "  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;",
        "  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);",
        "  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);",
        "  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);",
        "  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));",
        "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
        "  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);",
        "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
        "  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;",
        "  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;",
        "  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));",
        "}",
        "void main(){ float t=uTime*0.35;",
        /* ruído amostrado na normal da ESFERA -> cor/textura idênticas em toda forma */
        "  float n=snoise(normal*1.6+vec3(t,t*0.8,uMouse.x*1.5)); n+=0.5*snoise(normal*3.2+vec3(-t*1.3,t,uMouse.y*1.5));",
        "  vD=n;",
        "  vec3 mn=normalize(mix(aNrmA,aNrmB,uMix)); vNormal=mn;",
        "  vec3 base=mix(aPosA,aPosB,uMix);",
        "  vec3 pos=base+mn*n*0.28;",
        "  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0); }"
      ].join("\n"),
      fragmentShader:[
        "uniform vec3 cA; uniform vec3 cB; uniform vec3 cC; varying vec3 vNormal; varying float vD;",
        "void main(){ float g=smoothstep(-0.6,0.9,vD); vec3 col=mix(cA,cB,smoothstep(0.0,0.6,g));",
        "  col=mix(col,cC,smoothstep(0.55,1.0,g)); float fres=pow(1.0-abs(vNormal.z),2.0); col+=fres*0.35;",
        "  gl_FragColor=vec4(col,1.0); }"
      ].join("\n")
    });
    var mesh = new THREE.Mesh(geo, mat); scene.add(mesh);

    var pc=120, pg=new THREE.BufferGeometry(), pp=new Float32Array(pc*3);
    for(var i=0;i<pc;i++){ var r=1.7+Math.random()*0.9, a=Math.random()*6.28, b=Math.acos(2*Math.random()-1);
      pp[i*3]=r*Math.sin(b)*Math.cos(a); pp[i*3+1]=r*Math.sin(b)*Math.sin(a); pp[i*3+2]=r*Math.cos(b); }
    pg.setAttribute("position", new THREE.BufferAttribute(pp,3));
    var pts = new THREE.Points(pg, new THREE.PointsMaterial({color:0xffffff,size:0.02,transparent:true,opacity:0.5})); scene.add(pts);

    function resize(){ var s=tile.clientWidth; renderer.setSize(s,s,false); camera.aspect=1; camera.updateProjectionMatrix(); }
    if(window.ResizeObserver) new ResizeObserver(resize).observe(tile);
    window.addEventListener("resize", resize); resize();

    var mouse={x:0,y:0,tx:0,ty:0};
    tile.addEventListener("pointermove",function(e){ var rc=tile.getBoundingClientRect(); mouse.tx=((e.clientX-rc.left)/rc.width-0.5)*2; mouse.ty=((e.clientY-rc.top)/rc.height-0.5)*2; });
    tile.addEventListener("pointerleave",function(){ mouse.tx=0; mouse.ty=0; });

    /* ---------- máquina de estados do ciclo ---------- */
    var idx=0, phase="hold", phaseT=0, HOLD=2.9, MORPH=1.7, pending=null;
    function copyInto(attr, src){ attr.array.set(src); attr.needsUpdate=true; }
    function easeInOut(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

    /* hook de QA, opt-in por ?orbdebug — sem custo em produção */
    if(/[?&]orbdebug/.test(location.search)){
      window.__orb={ cycle:cycle, cache:cache, geo:geo, uniforms:uniforms,
        state:function(){ return {idx:idx, name:cycle[idx], phase:phase, mix:uniforms.uMix.value,
          built:Object.keys(cache), queued:queue.slice()}; } };
    }

    var clock=new THREE.Clock();
    function loop(){
      var dt=clock.getDelta(), t=clock.getElapsedTime();
      mouse.x+=(mouse.tx-mouse.x)*0.05; mouse.y+=(mouse.ty-mouse.y)*0.05;
      uniforms.uTime.value=t; uniforms.uMouse.value.set(mouse.x,mouse.y);
      mesh.rotation.y=t*0.15+mouse.x*0.4; mesh.rotation.x=mouse.y*0.3; pts.rotation.y=-t*0.05;

      if(cycle.length>1){
        pumpBuild();
        phaseT+=dt;
        if(phase==="hold" && phaseT>=HOLD){
          var nx=(idx+1)%cycle.length, nm=cycle[nx];
          var target=(nm==="orb")?orb:cache[nm];
          if(target && target.done){                    // só troca quando a forma está pronta
            copyInto(aPosB,target.pos); copyInto(aNrmB,target.nrm);
            pending=nx; phase="morph"; phaseT=0;
          } else { requestShape(nm); phaseT=HOLD-0.25; } // tenta de novo em breve
        } else if(phase==="morph"){
          var k=Math.min(1, phaseT/MORPH);
          uniforms.uMix.value=easeInOut(k);
          if(k>=1){
            idx=pending; var cur=(cycle[idx]==="orb")?orb:cache[cycle[idx]];
            copyInto(aPosA,cur.pos); copyInto(aNrmA,cur.nrm);
            uniforms.uMix.value=0; phase="hold"; phaseT=0;
          }
        }
      }
      renderer.render(scene,camera);
      if(!reduce) requestAnimationFrame(loop);
    }
    loop(); if(reduce) renderer.render(scene,camera);
  })();


  /* -------- animated SVG "tech" dashboards / arts (guarded by id) -------- */
  function dashboard(id,w,h,cols){
    var svg=document.getElementById(id); if(!svg) return; var pad=32;
    var g=el("g",{stroke:"#1c1c1c","stroke-width":"1"});
    for(var i=1;i<5;i++){ var y=pad+(h-2*pad)*i/5; g.appendChild(el("line",{x1:pad,y1:y,x2:w-pad,y2:y})); }
    svg.appendChild(g);
    var bw=(w-2*pad)/cols*0.5, bars=[];
    for(var b0=0;b0<cols;b0++){ var b=el("rect",{x:pad+(w-2*pad)*b0/cols+bw*0.3,width:bw,rx:2,fill:"#1f1f1f"}); svg.appendChild(b); bars.push(b); }
    var area=el("path",{fill:"rgba(255,255,255,.05)",stroke:"none"});
    var path=el("path",{fill:"none",stroke:"#fff","stroke-width":"2.5","stroke-linecap":"round","stroke-linejoin":"round"});
    svg.appendChild(area); svg.appendChild(path);
    var dot=el("circle",{r:4,fill:"#0099ff"}); svg.appendChild(dot);
    var pts=[]; for(var p0=0;p0<cols;p0++) pts.push(rand(.25,.85));
    function co(i,v){ return [pad+(w-2*pad)*i/(cols-1), h-pad-(h-2*pad)*v]; }
    var t=0; (function f(){ t+=0.02; var d="",a="";
      pts.forEach(function(v,i){ var vv=Math.min(.92,Math.max(.12,v+Math.sin(t+i)*0.06)); var c=co(i,vv); var x=c[0],y=c[1];
        d+=(i?" L":"M")+x.toFixed(1)+" "+y.toFixed(1); if(i===0)a="M"+x+" "+(h-pad); a+=" L"+x.toFixed(1)+" "+y.toFixed(1);
        if(i===cols-1){ dot.setAttribute("cx",x); dot.setAttribute("cy",y); }
        var bh=(h-2*pad)*vv*0.55; bars[i].setAttribute("y",h-pad-bh); bars[i].setAttribute("height",bh); });
      a+=" L"+(w-pad)+" "+(h-pad)+" Z"; path.setAttribute("d",d); area.setAttribute("d",a);
      if(!reduce) requestAnimationFrame(f); })();
  }
  dashboard("showWeb",720,480,11);

  (function phone(){ var svg=document.getElementById("showPhone"); if(!svg) return;
    svg.appendChild(el("rect",{x:20,y:24,width:150,height:15,rx:5,fill:"#1e1e1e"}));
    svg.appendChild(el("rect",{x:20,y:48,width:90,height:9,rx:4,fill:"#161616"}));
    svg.appendChild(el("rect",{x:20,y:78,width:220,height:110,rx:14,fill:"#111",stroke:"#222"}));
    var spark=el("path",{fill:"none",stroke:"#fff","stroke-width":"2.5","stroke-linecap":"round"}); svg.appendChild(spark);
    var sd=el("circle",{r:3.5,fill:"#0099ff"}); svg.appendChild(sd);
    var rows=[]; for(var i=0;i<4;i++){ var y=208+i*54;
      svg.appendChild(el("circle",{cx:40,cy:y+16,r:12,fill:"#181818"}));
      svg.appendChild(el("rect",{x:64,y:y+4,width:100,height:10,rx:4,fill:"#1e1e1e"}));
      svg.appendChild(el("rect",{x:64,y:y+22,width:60,height:8,rx:4,fill:"#151515"}));
      var v=el("rect",{x:190,y:y+6,width:44,height:22,rx:6,fill:"rgba(0,153,255,.16)"}); svg.appendChild(v); rows.push(v); }
    var t=0; (function f(){ t+=0.03; var d="",lx=0,ly=0;
      for(var i=0;i<=20;i++){ var x=32+i*(196/20); var y=133-Math.sin(t+i*0.5)*22-i*0.4; d+=(i?" L":"M")+x.toFixed(1)+" "+y.toFixed(1); lx=x; ly=y; }
      spark.setAttribute("d",d); sd.setAttribute("cx",lx); sd.setAttribute("cy",ly);
      rows.forEach(function(r,i){ r.setAttribute("opacity",0.6+Math.sin(t*2+i)*0.4); });
      if(!reduce) requestAnimationFrame(f); })();
  })();

  (function wire(){ var g=document.getElementById("wire"); if(!g) return;
    for(var i=0;i<=12;i++) g.appendChild(el("line",{x1:0,y1:i*45+30,x2:600,y2:i*45+30,stroke:"rgba(255,255,255,.14)","stroke-width":"1"}));
    for(var j=0;j<=14;j++) g.appendChild(el("line",{x1:j*45,y1:0,x2:j*45,y2:540,stroke:"rgba(255,255,255,.1)","stroke-width":"1"}));
    var orb=el("circle",{cx:420,cy:170,r:66,fill:"none",stroke:"rgba(255,255,255,.7)","stroke-width":"1.5"}); g.appendChild(orb);
    var t=0; (function f(){ t+=.02; orb.setAttribute("r",66+Math.sin(t)*13); orb.setAttribute("cx",420+Math.cos(t*.6)*28); if(!reduce) requestAnimationFrame(f); })();
  })();
  (function scrollviz(){ var g=document.getElementById("scrollviz"); if(!g) return; var bars=[];
    for(var i=0;i<9;i++){ var r=el("rect",{x:56+i*58,y:300,width:28,height:60,rx:4,fill:"none",stroke:"#242424"}); g.appendChild(r); bars.push(r); }
    var t=0; (function f(){ t+=.03; bars.forEach(function(b,i){ var hh=60+Math.abs(Math.sin(t+i*.5))*150; b.setAttribute("height",hh); b.setAttribute("y",360-hh); b.setAttribute("stroke", i===Math.floor(t%9)?"#fff":"#242424"); }); if(!reduce) requestAnimationFrame(f); })();
  })();
  (function eqviz(){ var g=document.getElementById("eqviz"); if(!g) return; var bars=[];
    for(var i=0;i<30;i++){ var r=el("rect",{x:16+i*20,y:115,width:9,height:20,rx:3,stroke:"none",fill:i%4===0?"#fff":"#333"}); g.appendChild(r); bars.push(r); }
    var t=0; (function f(){ t+=.05; bars.forEach(function(b,i){ var hh=14+Math.abs(Math.sin(t+i*.4))*80; b.setAttribute("height",hh); b.setAttribute("y",115-hh/2); }); if(!reduce) requestAnimationFrame(f); })();
  })();
  (function netviz(){ var g=document.getElementById("netviz"); if(!g) return; var nodes=[];
    for(var i=0;i<7;i++) nodes.push({x:50+i*90,y:115+Math.sin(i)*40});
    nodes.forEach(function(n,i){ if(i) g.appendChild(el("line",{x1:nodes[i-1].x,y1:nodes[i-1].y,x2:n.x,y2:n.y,stroke:"#2a2a2a","stroke-width":"1.4"})); });
    var cs=nodes.map(function(n,i){ var c=el("circle",{cx:n.x,cy:n.y,r:5,fill:i%3===0?"#fff":"#3a3a3a"}); g.appendChild(c); return c; });
    var t=0; (function f(){ t+=.04; cs.forEach(function(c,i){ c.setAttribute("r",5+Math.abs(Math.sin(t+i))*3); }); if(!reduce) requestAnimationFrame(f); })();
  })();

  /* -------- split-text: wrap words for a scroll reveal -------- */
  function splitWords(node){
    [].slice.call(node.childNodes).forEach(function(child){
      if(child.nodeType===3){
        if(!child.textContent.trim()) return;
        var frag=document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function(part){
          if(!part.trim()){ frag.appendChild(document.createTextNode(" ")); return; }
          var w=document.createElement("span"); w.className="word";
          var inner=document.createElement("span"); inner.textContent=part;
          w.appendChild(inner); frag.appendChild(w);
        });
        child.parentNode.replaceChild(frag, child);
      } else if(child.nodeType===1 && child.tagName!=="BR"){ splitWords(child); }
    });
  }

  /* -------- terminal typing loop (guarded by #term) -------- */
  function terminal(){
    var box=document.getElementById("term"); if(!box) return;
    var SCRIPT=[
      ["$ nody deploy --agent ","k"],["seu-negocio-01","v"],
      ["\n> carregando skills          ","c"],["ok","v"],
      ["\n> conectando whatsapp-api    ","c"],["ok","v"],
      ["\n> conectando crm / agenda    ","c"],["ok","v"],
      ["\n> treinando tom de voz       ","c"],["ok","v"],
      ["\n\n","c"],["agente no ar. ","k"],["primeira resposta em 0.8s","v"]
    ];
    function paint(){ box.innerHTML=SCRIPT.map(function(s){ return '<span class="'+s[1]+'">'+s[0].replace(/\n/g,"<br>")+'</span>'; }).join(""); }
    if(reduce){ paint(); return; }
    var seg=0,ch=0,out="";
    var io=new IntersectionObserver(function(e){ if(e[0].isIntersecting){ io.disconnect(); type(); } },{threshold:.3});
    io.observe(box);
    function type(){
      if(seg>=SCRIPT.length){ setTimeout(function(){ seg=0; ch=0; out=""; type(); },5200); return; }
      var txt=SCRIPT[seg][0], cls=SCRIPT[seg][1]; ch++;
      if(ch>=txt.length){ out+='<span class="'+cls+'">'+txt.replace(/\n/g,"<br>")+'</span>'; seg++; ch=0; }
      box.innerHTML=out+(ch?'<span class="'+cls+'">'+txt.slice(0,ch).replace(/\n/g,"<br>")+'</span>':"")+'<span class="term-cursor"></span>';
      setTimeout(type, txt[ch-1]==="\n"?90:18+Math.random()*26);
    }
  }

  /* -------- GSAP scroll choreography -------- */
  if(!reduce && window.gsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);

    gsap.to("#progress",{scaleX:1,ease:"none",scrollTrigger:{start:0,end:"max",scrub:.3}});
    var nav=document.getElementById("nav");
    if(nav){ ScrollTrigger.create({start:"top -30",end:99999,onUpdate:function(){ nav.classList.toggle("scrolled",window.scrollY>30); }});
      nav.classList.toggle("scrolled",window.scrollY>30); }

    if(document.querySelector(".hero .rv")){
      gsap.set(".hero .rv",{opacity:0,y:28});
      gsap.to(".hero .rv",{opacity:1,y:0,duration:1,ease:"power3.out",stagger:.1,delay:.12});
      gsap.to(".hero-copy",{y:-40,ease:"none",scrollTrigger:{trigger:".hero",start:"top top",end:"bottom top",scrub:true}});
      gsap.to(".showtile",{yPercent:-8,ease:"none",scrollTrigger:{trigger:".hero",start:"top top",end:"bottom top",scrub:true}});
      gsap.to(".hero-halo",{y:120,ease:"none",scrollTrigger:{trigger:".hero",start:"top top",end:"bottom top",scrub:true}});
    }

    gsap.utils.toArray("[data-split]").forEach(function(node){
      splitWords(node);
      gsap.set(node.querySelectorAll(".word > span"),{yPercent:110});
      gsap.to(node.querySelectorAll(".word > span"),{yPercent:0,duration:1,ease:"expo.out",stagger:.04,
        scrollTrigger:{trigger:node,start:"top 85%",once:true}});
    });

    gsap.utils.toArray(".rv:not(.hero .rv)").forEach(function(n){
      gsap.to(n,{opacity:1,y:0,duration:.9,ease:"power3.out",scrollTrigger:{trigger:n,start:"top 88%"}});
    });

    var track=document.getElementById("panTrack"), pin=document.getElementById("panPin"), bar=document.getElementById("panBar");
    if(track && pin){
      var dist=function(){ return track.scrollWidth-window.innerWidth; };
      gsap.to(track,{x:function(){ return -dist(); },ease:"none",scrollTrigger:{trigger:pin,start:"top top",end:function(){ return "+="+dist(); },pin:true,scrub:1,invalidateOnRefresh:true,onUpdate:function(s){ if(bar) bar.style.width=(s.progress*100).toFixed(1)+"%"; }}});
    }

    // counters via IntersectionObserver (fires for above-the-fold elements on load too)
    var countIO = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting) return;
        countIO.unobserve(e.target);
        var n=e.target, end=+n.dataset.count, o={v:0};
        gsap.to(o,{v:end,duration:1.5,ease:"power2.out",onUpdate:function(){ n.textContent=Math.round(o.v); }});
      });
    },{threshold:0});
    document.querySelectorAll("[data-count]").forEach(function(n){ countIO.observe(n); });

    var tl=document.getElementById("timeline"), fill=document.getElementById("tlFill");
    if(tl && fill){ var steps=tl.querySelectorAll(".tl-step");
      ScrollTrigger.create({trigger:tl,start:"top 70%",end:"bottom 60%",scrub:.5,onUpdate:function(s){
        fill.style.transform="scaleY("+s.progress+")";
        steps.forEach(function(st,i){ st.classList.toggle("active", s.progress > i/steps.length + .02); });
      }});
    }

    document.querySelectorAll("[data-mag]").forEach(function(b){
      b.addEventListener("mousemove",function(e){ var r=b.getBoundingClientRect(); gsap.to(b,{x:(e.clientX-r.left-r.width/2)*.3,y:(e.clientY-r.top-r.height/2)*.5,duration:.4}); });
      b.addEventListener("mouseleave",function(){ gsap.to(b,{x:0,y:0,duration:.5,ease:"elastic.out(1,.4)"}); });
    });

    terminal();
    window.addEventListener("load",function(){ ScrollTrigger.refresh(); });
  } else {
    document.querySelectorAll(".rv").forEach(function(n){ n.style.opacity=1; n.style.transform="none"; });
    document.querySelectorAll("[data-count]").forEach(function(n){ n.textContent=n.dataset.count; });
    var tf=document.getElementById("tlFill"); if(tf) tf.style.transform="scaleY(1)";
    document.querySelectorAll(".tl-step").forEach(function(s){ s.classList.add("active"); });
    terminal();
  }
})();
