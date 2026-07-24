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
     O orb continua exatamente como era: icosfera deslocada por ruído simplex.
     As outras formas são SÓLIDOS de verdade, montados com primitivas do Three
     (esferas, cilindros, caixas, toros). Nada de deformar a esfera em balança:
     malha de topologia esférica não vira objeto com partes separadas sem rasgar.
     A transição é uma dissolução cruzada — o orb encolhe e some enquanto o
     sólido cresce. Quando o sólido assenta, o ruído congela e a peça só gira
     com o mouse. Paleta idêntica nos dois: violeta → magenta → laranja. */
  (function three(){
    var tile = document.getElementById("showtile");
    var canvas = document.getElementById("glcanvas");
    if(!tile || !canvas || typeof THREE === "undefined") return;

    var renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 3.4;

    var root = new THREE.Group(); scene.add(root);

    var C = { a:new THREE.Color(0x6a4cf5), b:new THREE.Color(0xd44df0), c:new THREE.Color(0xff7a3d) };

    /* ---------- ruído simplex compartilhado ---------- */
    var SNOISE = [
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
      "}"
    ].join("\n");

    /* ---------- ORB (inalterado, + opacidade/escala para a transição) ---------- */
    var orbU = { uTime:{value:0}, uMouse:{value:new THREE.Vector2(0,0)}, uOpacity:{value:1},
                 cA:{value:C.a}, cB:{value:C.b}, cC:{value:C.c} };
    var orbMat = new THREE.ShaderMaterial({ uniforms:orbU, transparent:true,
      vertexShader:[
        "uniform float uTime; uniform vec2 uMouse; varying vec3 vNormal; varying float vD;",
        SNOISE,
        "void main(){ vNormal=normal; float t=uTime*0.35;",
        "  float n=snoise(normal*1.6+vec3(t,t*0.8,uMouse.x*1.5)); n+=0.5*snoise(normal*3.2+vec3(-t*1.3,t,uMouse.y*1.5));",
        "  vD=n; vec3 pos=position+normal*n*0.28; gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0); }"
      ].join("\n"),
      fragmentShader:[
        "uniform vec3 cA; uniform vec3 cB; uniform vec3 cC; uniform float uOpacity;",
        "varying vec3 vNormal; varying float vD;",
        "void main(){ float g=smoothstep(-0.6,0.9,vD); vec3 col=mix(cA,cB,smoothstep(0.0,0.6,g));",
        "  col=mix(col,cC,smoothstep(0.55,1.0,g)); float fres=pow(1.0-abs(vNormal.z),2.0); col+=fres*0.35;",
        "  gl_FragColor=vec4(col,uOpacity); }"
      ].join("\n")
    });
    var orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1,20), orbMat);
    root.add(orb);

    /* ---------- material dos SÓLIDOS: mesma paleta, com volume ---------- */
    function solidMaterial(){
      return new THREE.ShaderMaterial({
        transparent:true, depthWrite:true, side:THREE.DoubleSide,
        uniforms:{ uOpacity:{value:0}, uLo:{value:-1}, uHi:{value:1},
                   cA:{value:C.a}, cB:{value:C.b}, cC:{value:C.c} },
        vertexShader:[
          "varying vec3 vN; varying vec3 vW;",
          "void main(){ vN=normalize(normalMatrix*normal); vW=position;",
          "  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }"
        ].join("\n"),
        fragmentShader:[
          "uniform vec3 cA; uniform vec3 cB; uniform vec3 cC;",
          "uniform float uOpacity; uniform float uLo; uniform float uHi;",
          "varying vec3 vN; varying vec3 vW;",
          "void main(){",
          /* eixo do gradiente calibrado nos limites reais da peça:
             a paleta inteira (violeta -> magenta -> laranja) percorre a forma */
          "  float t=(vW.y*0.86 + vW.x*0.38 - uLo)/max(uHi-uLo,0.001);",
          "  float g=clamp(t,0.0,1.0);",
          "  vec3 col=mix(cA,cB,smoothstep(0.0,0.62,g)); col=mix(col,cC,smoothstep(0.58,1.0,g));",
          /* volume: difusa suave + rim, para ler como sólido e não como adesivo */
          "  vec3 n=gl_FrontFacing?vN:-vN;",
          "  float lam=0.74+0.30*max(dot(n,normalize(vec3(0.35,0.72,0.60))),0.0);",
          "  float fres=pow(1.0-abs(n.z),2.0);",
          "  col=col*lam+fres*0.34;",
          "  col=mix(col, col*1.14, 0.6);",   /* um pouco mais vivo, sem sair da paleta */
          "  gl_FragColor=vec4(col,uOpacity); }"
        ].join("\n")
      });
    }

    /* ---------- construtores de sólidos (primitivas de verdade) ----------
       As transformações são assadas na própria geometria: assim `position`
       no shader já é o espaço da peça inteira e o gradiente atravessa a
       forma toda, em vez de reiniciar em cada primitiva. */
    var _m4=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler();
    function add(group, geo, mat, px,py,pz, rx,ry,rz, sx,sy,sz){
      var g=geo.clone();
      _e.set(rx||0,ry||0,rz||0); _q.setFromEuler(_e);
      _m4.compose(new THREE.Vector3(px||0,py||0,pz||0), _q,
                  new THREE.Vector3(sx===undefined?1:sx, sy===undefined?1:sy, sz===undefined?1:sz));
      g.applyMatrix4(_m4);
      var m=new THREE.Mesh(g, mat); group.add(m); return m;
    }
    var SEG = 40;

    var BUILD = {
      /* cérebro: dois lobos com fissura, cerebelo e tronco */
      brain: function(mat){
        var g=new THREE.Group(), lobe=new THREE.SphereGeometry(0.62, SEG, SEG);
        for(var s=-1;s<=1;s+=2){
          add(g, lobe, mat, s*0.30, 0.16, 0, 0,0,0, 1.0,0.95,1.15);
          /* saliências dos giros, para não ficar uma bola lisa */
          for(var i=0;i<7;i++){
            var a=i/7*Math.PI*2;
            add(g, new THREE.SphereGeometry(0.20,18,18), mat,
                s*0.30+Math.cos(a)*0.40, 0.16+Math.sin(a)*0.34, Math.sin(a*1.7)*0.52);
          }
        }
        add(g, new THREE.SphereGeometry(0.30,SEG,SEG), mat, 0,-0.44,-0.34, 0,0,0, 1.25,0.72,0.9); // cerebelo
        add(g, new THREE.CylinderGeometry(0.13,0.10,0.42,24), mat, 0,-0.74,-0.16, 0.35,0,0);      // tronco
        return g;
      },

      /* dente molar: coroa larga com sulco + duas raízes cônicas */
      tooth: function(mat){
        var g=new THREE.Group();
        add(g, new THREE.SphereGeometry(0.56,SEG,SEG), mat, 0,0.30,0, 0,0,0, 1.06,0.90,0.92);   // coroa
        for(var s=-1;s<=1;s+=2){
          add(g, new THREE.SphereGeometry(0.30,SEG,SEG), mat, s*0.27,0.56,0, 0,0,0, 1,0.8,1);   // cúspides
          add(g, new THREE.CylinderGeometry(0.24,0.055,0.95,28), mat, s*0.26,-0.44,0, 0,0,-s*0.16); // raízes
        }
        return g;
      },

      /* coração anatômico: massa ventricular, átrios e vasos */
      heart: function(mat){
        var g=new THREE.Group();
        add(g, new THREE.SphereGeometry(0.60,SEG,SEG), mat, -0.04,0.02,0, 0,0,0.12, 1.02,1.16,0.92); // ventrículos
        add(g, new THREE.CylinderGeometry(0.46,0.02,0.78,30), mat, 0.06,-0.70,0, 0,0,0.20);          // ápice
        add(g, new THREE.SphereGeometry(0.30,SEG,SEG), mat, -0.34,0.52,0.02, 0,0,0, 1,0.86,1);       // átrio esq.
        add(g, new THREE.SphereGeometry(0.26,SEG,SEG), mat,  0.36,0.46,-0.04, 0,0,0, 1,0.86,1);      // átrio dir.
        /* vasos: arcos de toro + tubos retos */
        add(g, new THREE.TorusGeometry(0.26,0.085,14,26,Math.PI*0.9), mat, 0.02,0.66,0, 0,0,-0.35);
        add(g, new THREE.CylinderGeometry(0.085,0.085,0.42,20), mat, -0.26,0.92,0, 0,0,0.18);
        add(g, new THREE.CylinderGeometry(0.07,0.07,0.34,20), mat,  0.30,0.86,-0.06, 0,0,-0.22);
        add(g, new THREE.CylinderGeometry(0.06,0.06,0.30,18), mat,  0.05,0.95,0.10, 0.3,0,0.05);
        return g;
      },

      /* balança da justiça: base, coluna, travessa, dois pratos suspensos */
      scale: function(mat){
        var g=new THREE.Group();
        add(g, new THREE.CylinderGeometry(0.46,0.52,0.10,36), mat, 0,-0.92,0);                 // base
        add(g, new THREE.CylinderGeometry(0.34,0.40,0.07,36), mat, 0,-0.84,0);
        add(g, new THREE.CylinderGeometry(0.075,0.16,1.42,28), mat, 0,-0.10,0);                // coluna
        add(g, new THREE.CylinderGeometry(0.19,0.19,0.10,30), mat, 0,0.62,0, Math.PI/2,0,0);   // eixo
        add(g, new THREE.SphereGeometry(0.115,26,26), mat, 0,0.86,0);                          // pomo
        add(g, new THREE.CylinderGeometry(0.05,0.05,0.16,20), mat, 0,0.73,0);
        add(g, new THREE.CylinderGeometry(0.052,0.052,1.86,24), mat, 0,0.62,0, 0,0,Math.PI/2); // travessa
        var pan=new THREE.SphereGeometry(0.30,34,20,0,Math.PI*2,Math.PI*0.5,Math.PI*0.5);      // tigela
        for(var s=-1;s<=1;s+=2){
          add(g, pan, mat, s*0.90,-0.16,0, 0,0,0, 1,0.55,1);
          add(g, new THREE.SphereGeometry(0.055,16,16), mat, s*0.90,0.60,0);
          for(var k=-1;k<=1;k+=2)                                                              // cordas
            add(g, new THREE.CylinderGeometry(0.014,0.014,0.80,10), mat,
                s*0.90+k*0.11,0.22,k*0.09, k*0.13,0,-k*0.14);
        }
        return g;
      },

      /* monitor desktop: painel, moldura, pescoço e pé */
      screen: function(mat){
        var g=new THREE.Group();
        add(g, new THREE.BoxGeometry(1.70,1.08,0.11), mat, 0,0.34,0);        // painel
        add(g, new THREE.BoxGeometry(1.54,0.92,0.13), mat, 0,0.36,0.03);     // tela
        add(g, new THREE.BoxGeometry(0.20,0.30,0.10), mat, 0,-0.32,0);       // pescoço
        add(g, new THREE.BoxGeometry(0.86,0.09,0.34), mat, 0,-0.52,0);       // pé
        add(g, new THREE.CylinderGeometry(0.055,0.055,0.30,18), mat, 0,-0.32,0);
        return g;
      }
    };

    /* normaliza cada sólido para caber no mesmo espaço visual do orb */
    var solids = {};
    function getSolid(name){
      if(solids[name]) return solids[name];
      if(!BUILD[name]) return null;
      var mat=solidMaterial(), g=BUILD[name](mat);
      var box=new THREE.Box3().setFromObject(g), size=new THREE.Vector3(), ctr=new THREE.Vector3();
      box.getSize(size); box.getCenter(ctr);
      g.position.set(-ctr.x,-ctr.y,-ctr.z);
      var wrap=new THREE.Group(); wrap.add(g);
      /* normaliza pela extensão em TELA (x,y): usar a profundidade faria peças
         fundas, como o cérebro, aparecerem menores que as chatas */
      var k=2.42/Math.max(size.x,size.y);
      wrap.scale.setScalar(k);
      /* calibra o eixo do gradiente nos extremos reais da peça já centrada */
      var lo=1e9, hi=-1e9;
      g.traverse(function(m){
        if(!m.isMesh) return;
        var p=m.geometry.attributes.position, o=g.position;
        for(var i=0;i<p.count;i++){
          var v=(p.getY(i)+o.y)*0.86 + (p.getX(i)+o.x)*0.38;
          if(v<lo) lo=v; if(v>hi) hi=v;
        }
      });
      mat.uniforms.uLo.value=lo; mat.uniforms.uHi.value=hi;
      wrap.visible=false; root.add(wrap);
      solids[name]={group:wrap, mat:mat};
      return solids[name];
    }

    /* ---------- partículas ---------- */
    var pc=120, pg=new THREE.BufferGeometry(), pp=new Float32Array(pc*3);
    for(var i=0;i<pc;i++){ var r=1.7+Math.random()*0.9, a=Math.random()*6.28, b=Math.acos(2*Math.random()-1);
      pp[i*3]=r*Math.sin(b)*Math.cos(a); pp[i*3+1]=r*Math.sin(b)*Math.sin(a); pp[i*3+2]=r*Math.cos(b); }
    pg.setAttribute("position", new THREE.BufferAttribute(pp,3));
    var pts=new THREE.Points(pg,new THREE.PointsMaterial({color:0xffffff,size:0.02,transparent:true,opacity:0.5}));
    scene.add(pts);

    function resize(){ var s=tile.clientWidth; renderer.setSize(s,s,false); camera.aspect=1; camera.updateProjectionMatrix(); }
    if(window.ResizeObserver) new ResizeObserver(resize).observe(tile);
    window.addEventListener("resize", resize); resize();

    var mouse={x:0,y:0,tx:0,ty:0};
    tile.addEventListener("pointermove",function(e){ var rc=tile.getBoundingClientRect(); mouse.tx=((e.clientX-rc.left)/rc.width-0.5)*2; mouse.ty=((e.clientY-rc.top)/rc.height-0.5)*2; });
    tile.addEventListener("pointerleave",function(){ mouse.tx=0; mouse.ty=0; });

    /* ---------- ciclo: orb -> sólido -> orb -> próximo sólido ---------- */
    var forms=(tile.getAttribute("data-shapes")||"").split(",")
      .map(function(s){return s.trim();}).filter(function(s){return !!BUILD[s];});
    var fi=0, showing="orb", phase="hold", pt=0, HOLD_ORB=3.0, HOLD_SOLID=4.2, FADE=1.15;
    var cur=null;                       // sólido ativo
    var spin=0, noiseT=0;

    function easeOutBack(t){ var c1=1.70158,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); }
    function easeInOut(t){ return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }

    var clock=new THREE.Clock();
    function loop(){
      var dt=Math.min(clock.getDelta(),0.05);
      mouse.x+=(mouse.tx-mouse.x)*0.05; mouse.y+=(mouse.ty-mouse.y)*0.05;

      if(forms.length){
        pt+=dt;
        if(phase==="hold"){
          var lim = showing==="orb" ? HOLD_ORB : HOLD_SOLID;
          if(pt>=lim){
            if(showing==="orb"){ cur=getSolid(forms[fi]); if(cur) cur.group.visible=true; }
            phase="fade"; pt=0;
          }
        } else {
          var k=Math.min(1,pt/FADE), e=easeInOut(k);
          var toSolid = showing==="orb";
          var so = toSolid?e:1-e;                       // quanto do sólido está presente
          orbU.uOpacity.value = 1-so;
          orb.scale.setScalar(1-0.35*so);
          orb.visible = so<0.995;
          if(cur){
            cur.mat.uniforms.uOpacity.value = so;
            var g = toSolid ? easeOutBack(Math.max(k,0.001)) : e;   // sólido entra com leve overshoot
            cur.group.scale.setScalar(toSolid ? 0.72+0.28*g : 1-0.28*(1-so)/1);
          }
          if(k>=1){
            if(toSolid){ showing="solid"; }
            else { showing="orb"; if(cur){cur.group.visible=false;} cur=null; fi=(fi+1)%forms.length; }
            phase="hold"; pt=0;
          }
        }
      }

      /* ruído e giro automático só existem enquanto o orb está presente:
         com o sólido montado, a peça fica parada e só responde ao mouse */
      var orbness = orbU.uOpacity.value;
      /* orb transparente ainda escreveria profundidade e esconderia o sólido
         atrás dele — some com ele de vez e só escreve z quando está opaco */
      orb.visible = orbness > 0.02;
      orbMat.depthWrite = orbness > 0.95;
      noiseT += dt*orbness;
      spin   += dt*0.15*orbness;
      orbU.uTime.value = noiseT;
      orbU.uMouse.value.set(mouse.x, mouse.y);

      root.rotation.y = spin + mouse.x*0.55;
      root.rotation.x = mouse.y*0.32;
      pts.rotation.y  = -clock.getElapsedTime()*0.05;

      renderer.render(scene,camera);
      if(!reduce) requestAnimationFrame(loop);
    }

    if(/[?&]orbdebug/.test(location.search)){
      window.__orb={ forms:forms, solids:solids, getSolid:getSolid,
        scene:scene, camera:camera, orb:orb, root:root, pts:pts,
        state:function(){ return {showing:showing, phase:phase, form:forms[fi],
          orbOpacity:+orbU.uOpacity.value.toFixed(2),
          solidOpacity:cur?+cur.mat.uniforms.uOpacity.value.toFixed(2):null}; } };
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
