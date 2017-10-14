import decodeFloatRGBA from './parts/decodeFloatRGBA';
import ColorModes from '../programs/colorModes';
import UserDefinedVelocityFunction from './UserDefinedVelocityFunction';
import PanzoomTransform from './PanzoomTransform';

// TODO: this duplicates code from texture position.
export default class DrawParticleGraph {
  constructor(colorMode) {
    this.colorMode = colorMode;
    this.isUniformColor = colorMode === ColorModes.UNIFORM;
  }

  getFragmentShader() {
    let variables = [];
    var mainBody = [];

    if (this.isUniformColor) {
      variables.push('uniform vec4 u_particle_color;');
      mainBody.push('gl_FragColor = u_particle_color;');
    } else {
      variables.push('varying vec4 v_particle_color;');
      mainBody.push('gl_FragColor = v_particle_color;');
    }
    return `precision highp float;
${variables.join('\n')}

void main() {
${mainBody.join('\n')}
}`
  }

  getVertexShader(vfCode) {
    let decodePositions = textureBasedPosition();
    let colorParts = this.isUniformColor ? uniformColor() : textureBasedColor(this.colorMode, vfCode);
    let variables = [
      decodePositions.getVariables(),
      colorParts.getVariables()
    ]
    let methods = []
    addMethods(decodePositions, methods);
    addMethods(colorParts, methods);
    let main = [];
    addMain(decodePositions, main);
    addMain(colorParts, main);

    return `precision highp float;
attribute float a_index;
uniform float u_particles_res;

${variables.join('\n')}
${decodeFloatRGBA}
${methods.join('\n')}

void main() {
  vec2 txPos = vec2(
        fract(a_index / u_particles_res),
        floor(a_index / u_particles_res) / u_particles_res);
  gl_PointSize = 1.0;

${main.join('\n')}

  gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, (1. - 2. * (v_particle_pos.y)),  0., 1.);
}`
  }
}

function addMethods(producer, array) {
  if (producer.getMethods) {
    array.push(producer.getMethods());
  }
}
function addMain(producer, array) {
  if (producer.getMain) {
    array.push(producer.getMain());
  }
}

function textureBasedColor(colorMode, vfCode) {
  var udf = new UserDefinedVelocityFunction(vfCode);
  var panzoom = new PanzoomTransform({decode: true, srcPosName: 'v_particle_pos'});
  return {
    getVariables,
    getMain,
    getMethods
  }

  function getVariables() {
    let defines = '';
    if (colorMode === ColorModes.ANGLE) {
      defines = `#define M_PI 3.1415926535897932384626433832795`;
    }
    return `
uniform sampler2D u_colors;
uniform vec2 u_velocity_range;
${defines}
varying vec4 v_particle_color;
${panzoom.getDefines()}
${udf.getDefines()}
`
  }

  function getMethods() {
    return `
// https://github.com/hughsk/glsl-hsv2rgb
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

${panzoom.getFunctions()}
${udf.getFunctions()}
`
  }

  function getMain() {
    let decode = colorMode === ColorModes.VELOCITY ?
      `
  float speed = (length(velocity) - u_velocity_range[0])/(u_velocity_range[1] - u_velocity_range[0]);
  // float speed = (decodeFloatRGBA(encodedColor) - u_velocity_range[0])/(u_velocity_range[1] - u_velocity_range[0]);
  v_particle_color = vec4(hsv2rgb(vec3(0.05 + (1. - speed) * 0.5, 0.9, 1.)), 1.0);
` : `
  float speed = (atan(velocity.y, velocity.x) + M_PI)/(2.0 * M_PI);
  //float speed = (decodeFloatRGBA(encodedColor) + M_PI)/(2.0 * M_PI);
  v_particle_color = vec4(hsv2rgb(vec3(speed, 0.9, 1.)), 1.0);
`;

var moveToVectorSpace = `
vec2 du = (u_max - u_min);
vec2 pos = vec2(
  v_particle_pos.x * du.x + u_min.x,
  v_particle_pos.y * du.y + u_min.y);
`
    return `
${moveToVectorSpace}
vec2 velocity = get_velocity(pos);
// vec4 encodedColor = texture2D(u_colors, txPos);
${decode}
`
  }

}

function uniformColor() {
  return {
    getVariables,
    getMain
  }

  function getVariables() {

  }
  function getMain() {

  }
}

function textureBasedPosition() {
  return {
    getVariables,
    getMain
  }

  function getVariables() {
    return `
uniform sampler2D u_particles_x;
uniform sampler2D u_particles_y;
    `
  }

  function getMain() {
    return `
  vec2 v_particle_pos = vec2(
    decodeFloatRGBA(texture2D(u_particles_x, txPos)),
    decodeFloatRGBA(texture2D(u_particles_y, txPos))
  );
`
  }
}