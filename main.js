var regl = require('regl')()
var camera = require('./lib/cam.js')({
  width: window.innerWidth,
  height: window.innerHeight
})
var glsl = require('glslify')
var mat4 = require('gl-mat4')
var planeMesh = require('grid-mesh')(15, 12)

require('./lib/keys.js')(camera, document.body)

var cameraUniforms = regl({
  uniforms: {
    projection: () =>  camera.projection,
    view: () => camera.view
  }
})

require('resl')({
  manifest: {
    cube: {
      type: 'text',
      src: './assets/cube.json',
      parser: JSON.parse
    },
    castleexternal: {
      type: 'image',
      src: './assets/castleexternal.jpg',
      stream: true,
      parser: (data) => regl.texture({
        data: data,
        mag: 'linear',
        min: 'linear'
      })
    }
  },
  onDone: (assets) => {
    var draw = {
      bg: bg(),
      grid: drawGrid(),
      cube: cube(regl, assets.cube)
    }
    var cubeProps = [
      {
        texture: assets.castleexternal,
        model: new Float32Array(16)
      }
    ]
    function update (time) {
      var c = cubeProps[0].model
      mat4.identity(c)
      mat4.translate(c, c, [-20, -1, -20])
    }
    regl.frame(function ({ time }) {
      regl.clear({ color: [0,0,0,1], depth: true })
      draw.bg()
      cameraUniforms(function () {
        update(time)
        draw.cube(cubeProps)
        draw.grid()
      })
      camera.update()
    })
  }
})

function bg () {
  return regl({
    frag: glsl `
      precision highp float;
      #pragma glslify: snoise = require('glsl-noise/simplex/3d')
      #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
      varying vec2 uv;
      uniform float time;
      void main () {
        float h = 0.2*(snoise(vec3(uv, time*0.9))-1.5);
        float l0 = pow(
          (snoise(vec3(uv*32.0,time*0.2)+vec3(-time,0,0))*0.5+0.5), 16.0);
        vec3 c = hsl2rgb(h, 1.0, l0);
        gl_FragColor = vec4(c, length(c));
      }
    `,
    vert: `
      precision highp float;
      attribute vec2 position;
      varying vec2 uv;
      void main () {
        uv = position;
        gl_Position = vec4(position,0,1);
      }
    `,
    uniforms: { time: regl.context('time') },
    attributes: {
      position: [-4,-4,-4,4,4,0]
    },
    elements: [0,1,2],
    count: 3,
    depth: { enable: false, mask: false },
    blend: {
      enable: true,
      func: { src: 'src alpha', dst: 'one minus src alpha' }
    },
    depth: { mask: false }
  })

}

function drawGrid () {
  var mesh = {
    positions: [[-1,-1],[+1,-1],[+1,+1],[-1,+1]],
    cells: [[0,1,2],[0,2,3]]
  }
  return regl({
    frag: glsl `
      precision highp float;
      #pragma glslify: snoise = require('glsl-noise/simplex/3d')
      #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
      varying vec2 vpos;
      uniform float time;
      void main () {
        float h = 0.7 + 0.5*(snoise(vec3(vpos,time*0.3))*0.5);
        float l = pow(max(
          sin(vpos.x*128.0)*0.7+0.2*cos(time),
          sin(vpos.y*128.0)*0.7+0.2*cos(time)
        ),4.0);
        float flick = 0.5*0.4*sin(time*32.0) + 0.5*sin(time*2.0) + 1.0;
        flick = step(0.8, flick);
        float dflick = 1.3*mod(time, 2.0*abs(sin(time/2.0)));
        vec4 c = vec4(hsl2rgb(h,1.0,l*0.5), l);
        c += vec4(1.0,1.0,0.5,0.1)*(1.0-smoothstep(0.0, 0.15, length(vpos + vec2(0.25, 0.83))))*dflick;
        c += vec4(0.5,0.5,1.0,0.1)*(1.0-smoothstep(0.0, 0.13, length(vpos + vec2(0.08, 0.85))))*dflick;
        c += vec4(0,1,1,1)*(1.0-smoothstep(0.0, 0.4,
        length(vpos-vec2(-0.5,0.9))))*flick;
        gl_FragColor = c;
      }
    `,
    vert: glsl `
			attribute vec2 position;
			uniform mat4 projection, view;
			uniform float time;
			varying vec2 vpos;
			void main () {
        vpos = position;
        vec3 p = vec3(position.x,-0.2,position.y)*30.0;
        gl_Position = projection * view * vec4(p,1);
			}
    `,
    uniforms: { time: regl.context('time') },
    attributes: {
      position: mesh.positions
    },
    elements: mesh.cells,
    blend: {
      enable: true,
      func: { src: 'src alpha', dst: 'one minus src alpha' }
    }
  })
}

function cube (regl, mesh) {
  return regl({
    frag: `
      precision mediump float;
      varying vec2 vuv;
      uniform sampler2D texture;
      void main () {
        gl_FragColor = texture2D(texture, vuv);
      }
    `,
    vert: `
      precision mediump float;
      uniform mat4 model, projection, view;
      attribute vec2 uv;
      varying vec2 vuv;
      attribute vec3 position;
      void main () {
        vuv = uv;
        gl_Position = projection * view * model * vec4(position, 1.0);
      }`,
    attributes: {
      position: mesh.positions,
      uv: mesh.uv
    },
    elements: mesh.cells,
    uniforms: {
      model: regl.prop('model'),
      texture: regl.prop('texture'),
    },
    primitive: "triangles",
    blend: {
      enable: true,
      func: { src: 'src alpha', dst: 'one minus src alpha' }
    },
    cull: { enable: false }
  })
}
