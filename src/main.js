import './reset.css';
import './style.css';
import * as Three from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
/*------Three.Js-----*/
let scene, camera, canvas, renderer, lineGeo, lines, vert, frag;
let linesExist = false;
let textureLoader;
const objectMaxScale = 300.0;
const objectMinScale = 80.0;
let objects = [];
const fov = 60;
const near = 1;
const far = 10000;
const lineCount = 5000;
const lineMaxLength = 1000;
const lineMinLength = 400;
let vpAspect;
const camDepth = 300;
const cameraOffsetBuffer = 5000;
let camSocket;
//const rotationSpeed = 0.002;
let lastUpdate = Date.now();
let globalColor = null;
let startRotation, endRotation, rushStartTime, isCamRotating;
let camRotateDirection = 1;
let rushT = 0;
let rushDirection = 1;
let rushDuration;
let isRushing = false;
let isFirstRushColor = true;
let camBump = 0;
const camMaxBump = 80.0;
const camMinBump = 20.0;
let camBumpMult = 0;
let camBumpT = 0.0;
let camBumpCycleDuration = 1;
const camMinBumpCycleDur = 0.5;
const camMaxBumpCycleDur = 5; 
let bumpDuration = 0.15;
const minBumpDur = 0.2;
const maxBumpDur = 0.3;
let fontLoader;
const textObjects = [];
let isWorldInitialized = false;
let currentWinRes;
const resizeCheckIntervalDur = 3000;
/*------TRAIN AUDIO---------*/
const audioParamManagers = [];
let heavyMasterVol = 0.0;
let heavyFadeInDur = 10000;//ms
let scalerGain;
const amBase = 50;
let amWet, amDry;
let ringModulator, modulatorOscillator, trainSource;
let flangeDelay, flangeFeedbackGain, flangeWet, flangeDry;
let heavyFadeStartTime;
let fadeMaterial;
/*------START UI && STREAM / OTHER AUDIO------*/
let streamMasterGainNode;
let audioSelectContainer, audioSelect, audioDeviceID, audioContext;
let languageChangeDisplay, languageChangeTimeout;
let startPage, goBut, micBut, stream, convolverNode;
let ganeshaImageArray;//, ganeshaTimeout;
let ganeshaClearColor = new Three.Color(0,0,0);
let isGaneshaWaiting = false;
const ganeshaMinTime = 20000;
const ganeshaMaxTime = 300000;
const ganeshaColorFadeInDur = 500;
let ganeshaColorFadeTime = 6000;
let ganeshaColorFadeOutDur;
const ganeshaColorFadeOutMinDur = 3000;
const ganeshaColorFadeOutMaxDur = 10000;
let ganeshaFadeDir = -1;
/*------SPEECH2TEXT-------*/
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition; 
let isRecognitionRunning = false;
const pastPhrases = [];
const maxInputWords = 3;
const maxPastPhrases = 5;
let inactivityPrompt, inactivityShowTimeout;
const inactivityTimeoutDur = 20000;
const inactivityPromptDur = 3000;
/*-----BING IMAGE SEARCH-----*/
const searchApiKey = "your key here";
const maxSearchImages = 8;
const maxObjects = 50;
let currentLanguage = "en-US";
const languageOptions = ['en-US', 'th-TH', 'ja-JP', 'zh-CN','fr-FR', 
    'in-ID', 'es-ES', 'de-DE', 'nl-NL', 'he-IL', 'ru-RU'];
let languageSelect, languageSelectContainer;

class AudioParamManager
{
  #paramName;
  #targetVal;
  #lowRangeMin;
  #lowRangeMax;
  #highRangeMin;
  #highRangeMax;

  constructor(paramName, loMin = 0.0, loMax = 0.5, hiMin = 0.5, hiMax = 1.0)
  {
    this.#lowRangeMin = loMin;
    this.#lowRangeMax = loMax;
    this.#highRangeMin = hiMin;
    this.#highRangeMax = hiMax;

    this.#paramName = paramName;
  }
  setTargetVal(val)
  {
    this.#targetVal = val;
  }
  setRandomTarget(direction)
  {
    const min = direction == -1 ? this.#lowRangeMin : this.#highRangeMin;
    const max = direction == -1 ? this.#lowRangeMax : this.#highRangeMax;
    this.#targetVal = (max - min) * Math.random() + min;
  }
  startTransition(duration)
  {
    startAudioTransition(this.#paramName, this.#targetVal, duration);
  }
}
class Object
{
  #posObj = null; //parent of mesh
  #mesh = null;
  #uniforms = null;
  #isLoaded = false;
  #startPosition = null;
  #velocity = 0.0;
  #acceleration = 0.0;
  #yPos = 0;
  async #makeObject(imagePath)
  {
    this.#posObj = new Three.Object3D();

    const texture = await loadTexture(imagePath);

    const color = getGlobalColorVariant();
    const uniforms =
    {
        u_tex: { value: texture},
        u_vignetteWidth: { value: 1.0 }, //3.0
        u_vignetteStart: { value: 7.0 }, //15.0
        u_vignetteSize: { value: 1.0 },
        u_alpha: { value: 0.0 },
        u_time: { get value() { return 0.001 * performance.now() }},
        u_timeMultX: { value: Math.pow(Math.random(),2) * 0.95 + 0.05 },
        u_timeMultY: { value: Math.pow(Math.random(),2) * 0.95 + 0.05 },
        u_contrast: { value: 10.0 },
        u_brightness: { value: 0.5 },
        u_tint: { value: color}
    };
    const mat = new Three.ShaderMaterial
    ({
        uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false
    });

    const objectScale = Math.random() * (objectMaxScale - objectMinScale) + objectMinScale;
    const aspect = texture.image.width / texture.image.height;
    const geo = new Three.PlaneGeometry(aspect * objectScale, 1.0 * objectScale);
    const plane = new Three.Mesh(geo, mat);
    
    this.#uniforms = uniforms;
    this.#mesh = plane;
    
    this.#posObj.add(this.#mesh);
    this.#posObj.position.copy(this.#startPosition);
    scene.add(this.#posObj);

    this.#isLoaded = true;
  }
  #getStartPosition()
  {
    const zRange = camDepth + 100;
    const z = Math.random() * camDepth * 2 - zRange;
    const vWidth = visibleWidthAtZDepth(z);
    const vHeight = visibleHeightAtZDepth(z);
    const x = vWidth * 0.6 + Math.random() * 600;
    const y = (Math.random() * vHeight - vHeight * 0.5) * 0.8;
    this.#yPos = y;
    const pos = new Three.Vector3(x,y,z);
    return pos;
  }
  update(delta)
  {
    if(!this.#isLoaded)
    {
      return;
    }
    this.#updatePosition(delta);
    this.#uniforms.u_alpha.value += 0.001 * delta;
    this.#uniforms.u_alpha.value = Math.min(1, this.#uniforms.u_alpha.value);
  }
  #setAcceleration()
  {    
    this.#acceleration = Math.random() * 0.0002 + 0.00003;//Math.random() * 0.0 + 0.33;
  }
  #updatePosition(delta)
  {
    this.#posObj.position.x -= this.#velocity * delta;
    this.#posObj.position.y = this.#yPos + camBump;
    const vpWidth = visibleWidthAtZDepth(this.#posObj.position.z);
    const vpLeft = 0 - vpWidth * 0.5;
    this.#velocity += this.#acceleration * delta;
    if(this.#posObj.position.x < vpLeft - cameraOffsetBuffer)
    {
      scene.remove(this.#posObj);
      const i = objects.indexOf(this);
      objects.splice(i, 1);
    }

    // Calculate the direction vector from the mesh to the camera
    const direction = new Three.Vector3();
    camera.getWorldPosition(direction);
    direction.sub(this.#mesh.getWorldPosition(new Three.Vector3())).normalize();

    // Create a quaternion from the direction vector
    const targetQuaternion = new Three.Quaternion();
    targetQuaternion.setFromUnitVectors(new Three.Vector3(0, 0, 1), direction);

    // Rotate the mesh towards the target quaternion
    const step = 0.1 * delta;
    this.#mesh.quaternion.rotateTowards(targetQuaternion, step);
  }
  constructor(imagePath)
  {
    this.#setAcceleration();
    this.#startPosition = this.#getStartPosition();
    this.#makeObject(imagePath);
  }
}
class TextObject
{
  #posMesh = new Three.Object3D();
  #textMesh = null;
  #velocity = 0.0;
  #rotSpeed;
  #isOn = false;
  #minZDepth = 65;
  #maxZDepth = 280;
  #zDepthNorm = 0;
  #initLight()
  {
    const pointLight = new Three.PointLight(0xffffff, 7000);
    pointLight.position.set(0,0,50);
    this.#posMesh.add(pointLight);
  }
  #setVelocities()
  {    
    const nearnessScaler = (Math.abs(this.#posMesh.position.z) - this.#minZDepth) / (this.#maxZDepth - this.#minZDepth);
    this.#velocity = Math.random() * 0.08 * nearnessScaler + 0.05;
    let x = Math.random() * 0.0002 + 0;
    let y = Math.random() * 0.0001 + 0.000001;
    let z = Math.random() * 0.0002 + 0;    
    x = Math.random() > 0.5 ? -x : x;
    y = Math.random() > 0.5 ? -y : y;
    z = Math.random() > 0.5 ? -z : z;
    this.#rotSpeed = new Three.Vector3(x,y,z);
  }
  #makeObject(text, language)
  {    
    let input = text;
    return new Promise((resolve) => 
    {
      //console.log("start make");
      let fontFile = 'fonts/';
      if(language == 'ja-JP' || language == 'zh-CN')
      {
        fontFile += 'Noto Sans JP Light_Regular.json';
      }
      else if(language == 'th-TH')
      {
        fontFile += 'Noto Sans Thai Condensed Light_Regular.json';
      }
      else if(language == 'zh-CN')
      {
        fontFile += 'Noto Sans SC Light_Regular.json';
      }
      else if(language == 'he-IL')
      {
        fontFile += 'Noto Sans Hebrew Condensed Light_Regular.json';
        input = text.split('').reverse().join('');
      }
      else
      {
        fontFile += 'Noto Sans Medium_Regular.json';
      }

      fontLoader.load(fontFile, (font) =>
      {
        const geometry = new TextGeometry(input, 
        {
          font: font,
          size: 10,
          depth: 8,
          curveSegments: 12,
          bevelEnabled: true,
          bevelThickness: 1,
          bevelSize: 1,
          bevelOffset: 0,
          bevelSegments: 2
        });
        geometry.center();
        const color = getGlobalColorVariant();
        const material = new Three.MeshStandardMaterial({ color: color });
        const textMesh = new Three.Mesh(geometry, material);
        //console.log("MESHTIME", this.#mesh, textMesh)
        this.#textMesh = textMesh;
        this.#posMesh.add(this.#textMesh);
        camera.add(this.#posMesh);
        resolve();
      });
    })
    
  }
  #setStartPosition()
  {
    this.#zDepthNorm = Math.random();
    const z = -((this.#zDepthNorm * (this.#maxZDepth - this.#minZDepth) + this.#minZDepth));
    const vWidth = visibleWidthAtZDepth(z + camera.position.z);
    const vHeight = visibleHeightAtZDepth(z + camera.position.z);
    const x = vWidth * 0.6 + vWidth * Math.pow(1.0 - this.#zDepthNorm, 2); 
    const y = vHeight * (Math.random() * 0.6 - 0.3);
    this.#posMesh.position.set(x,y,z);
    const camWorldPos = new Three.Vector3();
    camera.getWorldPosition(camWorldPos);
    const meshWorldPos = new Three.Vector3();
    this.#posMesh.getWorldPosition(meshWorldPos);
  }
  update(delta)
  {    
    if(!this.#isOn)
    {
      return;
    }
    this.#posMesh.position.x -= this.#velocity * delta;
    const vpWidth = visibleWidthAtZDepth(this.#posMesh.position.z + camera.position.z);
    const vpLeft = 0 - vpWidth * 0.5;
    if(this.#posMesh.position.x < vpLeft - 1000)
    {
      camera.remove(this.#posMesh);
      const i = textObjects.indexOf(this);
      textObjects.splice(i, 1);
      return;
    }
    this.#textMesh.rotation.x += this.#rotSpeed.x * delta;
    this.#textMesh.rotation.y += this.#rotSpeed.y * delta;
    this.#textMesh.rotation.z += this.#rotSpeed.z * delta;
  }
  constructor(text, language)
  {
    this.#makeObject(text, language)
    .then(() => 
    {
      this.#setStartPosition();
      this.#initLight();
      this.#setVelocities();
      this.#isOn = true;
    });
  }  
}

document.addEventListener("DOMContentLoaded", async () =>
{    
  const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  if(isFirefox)
  {
    const firefoxNotice = document.querySelector('.js-firefox-notice');
    firefoxNotice.classList.toggle('hidden', false);
  }

  inactivityPrompt = document.querySelector('.js-inactivity-prompt');
  fontLoader = new FontLoader();
  buildThaiDictionary();
  setUpLanguageSelect();
  
  startPage = document.querySelector('.js-start-page');
  goBut = document.querySelector('.js-go-button');
  micBut = document.querySelector('.js-mic-button');
  micBut.addEventListener('click', async () =>
  {
    initAudioParams(); 
    await startAudioStream();
    updateDeviceList();
    audioSelectContainer.classList.toggle('hidden', false);
    goBut.classList.toggle('hidden', false);    
    micBut.classList.toggle('hidden', true);
    audioSelect.addEventListener('change', async () =>
    {
      audioDeviceID = audioSelect.value;
      await stopStream();
      await startAudioStream();      
      updateDeviceList();
    });

    goBut.addEventListener('click', async () =>
    {
      const loadingNotice = document.querySelector('.js-loading-notice');
      loadingNotice.classList.toggle('hidden', false);
      startPage.classList.toggle('hidden', true);
      initVoiceRecognition();
      await initAudioNodes();
      await initTrainSound();      
      loadingNotice.classList.toggle('hidden', true);
      initWorld();
    });
  });
});
function initAudioNodes()
{
  return new Promise((resolve) =>
  {
    const source = audioContext.createMediaStreamSource(stream);
  
    convolverNode = audioContext.createConvolver();
    fetch('1 Halls 03 Small Hall.C.1.wav')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(audioBuffer => 
    {
      convolverNode.buffer = audioBuffer;
      convolverNode.normalize = true; 
      streamMasterGainNode = audioContext.createGain();
      const wetGainNode = audioContext.createGain();
      const dryGainNode = audioContext.createGain();
      streamMasterGainNode.gain.value = 0.0;
      wetGainNode.gain.value = 0.2;//0.3;
      dryGainNode.gain.value = 0.2;
      source.connect(streamMasterGainNode);
      streamMasterGainNode.connect(wetGainNode);
      streamMasterGainNode.connect(dryGainNode);
      wetGainNode.connect(convolverNode);
      dryGainNode.connect(audioContext.destination);
  
      convolverNode.connect(audioContext.destination);
      
      resolve();
    })
    .catch(error => console.error('Error loading impulse response:', error)); 
  })
}
async function initWorld()
{
  lastUpdate = Date.now();
  setGlobalColor();

  scene = new Three.Scene();
  vpAspect = window.innerWidth / window.innerHeight;
  camera = new Three.PerspectiveCamera(fov, vpAspect, near, far);
  camSocket = new Three.Object3D();
  camSocket.position.set(-1000, 0, 0);
  scene.add(camSocket);
  camSocket.add(camera);
  camera.position.set(0, 0, camDepth);
  camera.rotation.set(0, 0, 0);
  
  canvas = document.querySelector('#main');
  renderer = new Three.WebGLRenderer
  ({
    canvas: canvas,
    antialias: true,
  });
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  renderer.setSize(winW, winH);
  currentWinRes = {'width': winW, 'height': winH};
  setInterval(checkForResize, resizeCheckIntervalDur);

  initLines();
  textureLoader = new Three.TextureLoader();
  initFadeMesh();
  const ganeshaTime = Math.random() * (ganeshaMaxTime - ganeshaMinTime) + ganeshaMinTime;
  setTimeout(summonGanesha, ganeshaTime);

  await initObjectShader();

  animate();
  isWorldInitialized = true;

  inactivityShowTimeout = setTimeout(showInactivityPrompt, inactivityTimeoutDur + heavyFadeInDur);
}
function showInactivityPrompt()
{
  if(isRushing)
  {
    inactivityShowTimeout = setTimeout(showInactivityPrompt, inactivityTimeoutDur);
    return;
  }
  inactivityPrompt.classList.toggle('hidden', false);
  setTimeout(() =>
  {
    inactivityPrompt.classList.toggle('hidden', true);
    inactivityShowTimeout = setTimeout(showInactivityPrompt, inactivityTimeoutDur);
  }, inactivityPromptDur);
}
function updateClearColorFade(time)
{
  if(!ganeshaColorFadeTime)
  {
    ganeshaColorFadeTime = time;
  }
  const elapsed = time - ganeshaColorFadeTime;
  const dur = ganeshaFadeDir == 1 ? ganeshaColorFadeInDur : ganeshaColorFadeOutDur;
  let t = elapsed / dur;
  t = ganeshaFadeDir == -1 ? 1 - t : t;
  const c = new Three.Color(ganeshaClearColor.r * t,ganeshaClearColor.g * t,ganeshaClearColor.b * t);
  renderer.setClearColor(c);

  if(ganeshaFadeDir == 1 && t > 1.0)
  {
    ganeshaFadeDir = -1;
    ganeshaColorFadeTime = null;
  }
}
function shuffleArray(array) 
{
  for (let i = array.length - 1; i > 0; i--) 
  {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}
function summonGanesha()
{
  const imageCount = 12;
  const maxImages = 8;
  ganeshaImageArray = [];
  for(let i = 0; i < imageCount; ++i)
  {
    const fileName = 'images/tua/' + i.toString().padStart(2,'0') + '.webp';
    ganeshaImageArray.push(fileName);
  }
  const shuffledImages = shuffleArray(ganeshaImageArray).slice(0, maxImages);

  if(!isRushing)
  {
    isFirstRushColor = true;
    startRush();
    startCameraRotation(); 
    startAudioChanges(rushDirection);
    playGaneshaAudio();
    setGlobalColor();
    spawnObjects(shuffledImages);
    const ganeshaString = getGaneshaString(); 
    const textObj = new TextObject(ganeshaString, currentLanguage);
    textObjects.push(textObj);
    startGaneshaFade();
  }
  else
  {
    isGaneshaWaiting = true;
    ganeshaImageArray = ganeshaImageArray.slice(0, 5);
  }
}
function startGaneshaFade()
{
  ganeshaClearColor = getRandomColor();
  ganeshaFadeDir = 1;
  ganeshaColorFadeOutDur = Math.random() * (ganeshaColorFadeOutMaxDur - ganeshaColorFadeOutMinDur) + ganeshaColorFadeOutMinDur;
  ganeshaColorFadeTime = null;
}
async function playGaneshaAudio()
{
  const soundCount = 9;
  const j = Math.floor(Math.random() * soundCount);
  const response = await fetch('sounds/tua/' + j.toString() + '.wav');
  //console.log("response", response);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;        
  const ganeshaGain = audioContext.createGain();
  source.connect(ganeshaGain);
  ganeshaGain.gain.value = 0.5;
  ganeshaGain.connect(convolverNode); //connect stream to worklet
  ganeshaGain.connect(audioContext.destination);
  source.start();
  source.onended = () =>
  {
    const ganeshaTime = Math.random() * (ganeshaMaxTime - ganeshaMinTime) + ganeshaMinTime;
    setTimeout(summonGanesha, ganeshaTime);
  };
}
function initFadeMesh() //for scene fade-in
{
  const geo = new Three.PlaneGeometry(3,2);
  fadeMaterial = new Three.MeshBasicMaterial({color: 0x000000, transparent: true});
  const mesh = new Three.Mesh(geo, fadeMaterial);
  mesh.position.z = -1;
  camera.add(mesh);
}
function startAudioChanges(dir)
{
  audioParamManagers.forEach((apm) =>
  {
    apm.setRandomTarget(dir);
    apm.startTransition(rushDuration);
  });
}
function initAudioParamManager(name, startVal, loMin, loMax, hiMin, hiMax)
{
  const apm = new AudioParamManager(name, loMin, loMax, hiMin, hiMax);
  audioParamManagers.push(apm);
}
function fadeAmMix(value, duration) 
{
  const inverse = 1.0 - value;
  const now = audioContext.currentTime;

  amWet.gain.cancelScheduledValues(now);
  amWet.gain.setValueAtTime(amWet.gain.value, now);
  amWet.gain.linearRampToValueAtTime(value, now + duration); // Fade to no modulation

  amDry.gain.cancelScheduledValues(now);
  amDry.gain.setValueAtTime(amDry.gain.value, now);
  amDry.gain.linearRampToValueAtTime(inverse, now + duration); // Fade to no modulation
}
function fadePlaybackSpeed(value, duration)
{
  const now = audioContext.currentTime;
  trainSource.playbackRate.cancelScheduledValues(now);
  trainSource.playbackRate.setValueAtTime(trainSource.playbackRate.value, now);
  trainSource.playbackRate.linearRampToValueAtTime(value, now + duration);
}
function fadeAmMod(value, duration)
{
  const now = audioContext.currentTime;
  const hz = Math.pow(value,2) * 100 * amBase;
  modulatorOscillator.frequency.cancelScheduledValues(now);
  modulatorOscillator.frequency.setValueAtTime(modulatorOscillator.frequency.value, now);
  modulatorOscillator.frequency.linearRampToValueAtTime(hz, now + duration);
}
function fadeFlangeDelay(value, duration)
{
  const now = audioContext.currentTime;
  const valueS = value / 1000; //ms to s
  flangeDelay.delayTime.cancelScheduledValues(now);
  flangeDelay.delayTime.setValueAtTime(flangeDelay.delayTime.value, now);
  flangeDelay.delayTime.linearRampToValueAtTime(valueS, now + duration);
}
function fadeFlangeFeedback(value, duration)
{
  const now = audioContext.currentTime;

  flangeFeedbackGain.gain.cancelScheduledValues(now);
  flangeFeedbackGain.gain.setValueAtTime(flangeFeedbackGain.gain.value, now);
  flangeFeedbackGain.gain.linearRampToValueAtTime(value, now + duration);
}
function fadeFlangeMix(value, duration)
{
  const now = audioContext.currentTime;
  const inverted = 1.0 - value;

  flangeDry.gain.cancelScheduledValues(now);
  flangeDry.gain.setValueAtTime(flangeDry.gain.value, now);
  flangeDry.gain.linearRampToValueAtTime(inverted, now + duration);

  flangeWet.gain.cancelScheduledValues(now);
  flangeWet.gain.setValueAtTime(flangeWet.gain.value, now);
  flangeWet.gain.linearRampToValueAtTime(value, now + duration);
}
async function initTrainSound()
{
  const response = await fetch('./sounds/train3m.mp3');
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    

  trainSource = audioContext.createBufferSource();
  trainSource.buffer = audioBuffer;     
  trainSource.loop = true;   
  trainSource.start();

  ringModulator = audioContext.createGain();
  modulatorOscillator = audioContext.createOscillator();  
  amWet = audioContext.createGain();
  amDry = audioContext.createGain();
  const ringModOut = audioContext.createGain();
  modulatorOscillator.type = 'sine';
  modulatorOscillator.frequency.value = 100; // Modulation frequency in Hz
  modulatorOscillator.start();
  modulatorOscillator.stop(audioContext.currentTime + 36000);

  trainSource.connect(amDry);
  amDry.connect(ringModOut);
  trainSource.connect(ringModulator);
  ringModulator.connect(amWet);
  amWet.connect(ringModOut);  
  modulatorOscillator.connect(ringModulator.gain);

  scalerGain = audioContext.createGain();
  scalerGain.gain.value = 1.0;
  ringModOut.connect(scalerGain);

  amWet.gain.value = 0.0;
  amDry.gain.value = 1.0;

  flangeDelay = audioContext.createDelay();
  flangeFeedbackGain = audioContext.createGain();
  flangeDry = audioContext.createGain();
  flangeWet = audioContext.createGain();
  const flangeOut = audioContext.createGain();
  const flangeWetGain = audioContext.createGain();
  flangeDry.gain.value = 1.0;
  flangeWet.gain.value = 0.0;
  flangeWetGain.gain.value = 0.3;

  flangeDelay.delayTime.value = 11 / 1000;
  flangeFeedbackGain.gain.value = 0.9;

  const trainMaster = audioContext.createGain();
  const trainWet = audioContext.createGain();
  const trainDry = audioContext.createGain();
  trainMaster.gain.value = 0.0;
  trainWet.gain.value = 0.3;
  trainDry.gain.value = 0.3;

  scalerGain.connect(flangeDry);
  scalerGain.connect(flangeDelay);
  flangeDelay.connect(flangeFeedbackGain);
  flangeFeedbackGain.connect(flangeDelay);
  flangeDelay.connect(flangeWet);
  flangeWet.connect(flangeWetGain);
  flangeWetGain.connect(flangeOut);
  flangeDry.connect(flangeOut);
  flangeOut.connect(trainMaster);

  trainMaster.connect(trainWet);
  trainMaster.connect(trainDry);  
  
  trainWet.connect(convolverNode);
  trainDry.connect(audioContext.destination);
  const now = audioContext.currentTime;
  trainMaster.gain.linearRampToValueAtTime(1.0, now + heavyFadeInDur / 1000);
  streamMasterGainNode.gain.linearRampToValueAtTime(1.0, now + heavyFadeInDur / 1000);

  initAudioParamManager('amMix', 1.0, 0.1, 0.35, 0.75, 1.0);
  initAudioParamManager('amMod', 0, 0, 1, 0, 1);
  initAudioParamManager('flangeDelay', 6.0, 2, 20, 2, 20);
  initAudioParamManager('flangeFeedback', 0.6, 0.4, 0.6, 0.9, 0.99);
  initAudioParamManager('flangeMix', 0.0, 0.1, 0.5, 0.6, 1.0);
  initAudioParamManager('speedMult', 1.0, 0.4, 1.0, 3.0, 10.0);
}
function updateAudioFadeIn(time)
{
  if(!heavyFadeStartTime)
  {
    heavyFadeStartTime = time;
  }
  const elapsed = time - heavyFadeStartTime;
  heavyMasterVol = Math.min(1.0, elapsed / heavyFadeInDur);
}
function startAudioTransition(name, value, duration)
{
  if(name == 'amMix')
  {
    fadeAmMix(value, duration);
  }
  else if(name == 'amMod')
  {
    fadeAmMod(value, duration);
  }
  else if(name == 'speedMult')
  {
    fadePlaybackSpeed(value, duration);
  }
  else if(name == 'flangeDelay')
  {
    fadeFlangeDelay(value, duration);
  }
  else if(name == 'flangeFeedback')
  {
    fadeFlangeFeedback(value, duration);
  }
  else if(name == 'flangeMix')
  {
    fadeFlangeMix(value, duration);
  }
}
function startRush()
{
  isRushing = true;
  rushDirection = 1;
  rushDuration = Math.random() * 8 + 2;
  rushStartTime = null;

  clearTimeout(inactivityShowTimeout);
  clearTimeout(inactivityShowTimeout);
  inactivityPrompt.classList.toggle('hidden', true);
}
function updateRush(time)
{
  if(!isRushing)
  {
    return;
  }
  if (!rushStartTime) 
  {
    rushStartTime = time;
  }
  const elapsed = (time - rushStartTime) / 1000; // Convert to seconds
  rushT = Math.min(elapsed / rushDuration, 1); // Ensure t doesn't exceed 1
 
  if(rushT == 1 && rushDirection == 1)
  {
    rushT = 0;
    rushStartTime = time;
    rushDirection = -1;
    audioParamManagers.forEach((apm) =>
    {
      apm.setRandomTarget(rushDirection);
      apm.startTransition(rushDuration);
    });
  } 
  else if(rushT == 1 && rushDirection == -1)
  {
    isRushing = false;
    inactivityShowTimeout = setTimeout(showInactivityPrompt, inactivityTimeoutDur);
  }
  else if(rushT > 0.75 && rushDirection == -1 && isFirstRushColor)
  {    
    isFirstRushColor = false;
    setGlobalColor();
  }
}
function updateCameraBump(delta)
{
  const camBumpSpeed = 1 / camBumpCycleDuration / 1000;
  camBumpT += delta * camBumpSpeed ;
  const bumpFrac = bumpDuration / camBumpCycleDuration
  const bumpFracInv = 1.0 - bumpFrac;

  const bumpRange = ((Math.min(1.0, Math.max(bumpFracInv, camBumpT)) - bumpFracInv) / bumpFrac) * 0.5;
  const adjBump = Math.sin(bumpRange * Math.PI * 2);

  const offset = adjBump * camBumpMult;
  camBump = offset;
  
  if(camBumpT > 1.0)
  {
    camBumpT = 0;
    camBumpMult = Math.random() * (camMaxBump - camMinBump) + camMinBump;
    camBumpCycleDuration = Math.random() * (camMaxBumpCycleDur - camMinBumpCycleDur) + camMinBumpCycleDur;
    bumpDuration = Math.pow(Math.random(),2) * (maxBumpDur - minBumpDur) + minBumpDur;
  }
}
function updateCameraRotation()
{ 
  if(!isRushing || !isCamRotating)
  {
    return;
  } //camT is twice as long as rushT 
  const t = rushDirection == 1 ? rushT * 0.5 : rushT * 0.5 + 0.5;
  if(t < 1)
  {
    camSocket.quaternion.copy(startRotation).slerp(endRotation, t);
  }
  else
  {
    isCamRotating = false;
  }
}

function startCameraRotation()
{
  const x = 0; //camRotateDirection is either -1 or 1
  const y = camRotateDirection * -(Math.random() * 100 + 70);
  const z = 0;

  startRotation = new Three.Quaternion().copy(camSocket.quaternion);

  endRotation = new Three.Quaternion().setFromEuler
  (new Three.Euler(
    Three.MathUtils.degToRad(x),
    Three.MathUtils.degToRad(y),
    Three.MathUtils.degToRad(z)
  ));
  camRotateDirection = !camRotateDirection;
  isCamRotating = true;
}

async function spawnObjects(images)
{
  for(let i = 0; i < images.length; ++i)
  {
    const delTime = Math.random() * 1200 + 100;
    await delay(delTime);
    if(objects.length >= maxObjects)
    {
      break;
    }
    const obj = new Object(images[i]);
    objects.push(obj);    
  }
}

function delay(ms)
{
  return new Promise((resolve) =>
  {
    setTimeout(resolve, ms);
  });
}

function setGlobalColor()
{  
  globalColor = getRandomColor();
}
function getRandomColor()
{
  const startIndex = Math.floor(Math.random() * 3);
  const colorValues = getBaseColorValues();
  const r = colorValues[startIndex];
  const g = colorValues[(startIndex + 1) % 3];
  const b = colorValues[(startIndex + 2) % 3];
  return new Three.Color(r,g,b);
}

function getBaseColorValues()
{
  const a = 0.0;
  const b = Math.random();
  const c = Math.random() * 0.5 + 0.5;
  return [a,b,c];
}

function getGlobalColorVariant()
{
  const r = Math.min(globalColor.r + Math.random() * 0.5); 
  const g = Math.min(globalColor.g + Math.random() * 0.5); 
  const b = Math.min(globalColor.b + Math.random() * 0.5); 
  const color = new Three.Color(r,g,b);
  return color;
}

function getDelta(time)
{
  const delta = isNaN(lastUpdate) ? 0 : time - lastUpdate;
  lastUpdate = time;
  return delta;
}
const visibleHeightAtZDepth = ( depth ) => 
{
  // compensate for cameras not positioned at z=0
  const cameraOffset = camDepth;
  if ( depth < cameraOffset ) depth -= cameraOffset;
  else depth += cameraOffset;

  // vertical fov in radians
  const vFOV = camera.fov * Math.PI / 180; 

  // Math.abs to ensure the result is always positive
  return 2 * Math.tan( vFOV / 2 ) * Math.abs( depth );
};

const visibleWidthAtZDepth = ( depth ) => 
{
  const height = visibleHeightAtZDepth( depth, camera );
  return height * camera.aspect;
};

function loadTexture(imageUrl)
{
    return new Promise((resolve, reject) => 
    {
     textureLoader.load(imageUrl, (texture) => { resolve(texture)}, undefined, () => { console.log("error loading texture", error); reject()});
    });
}

async function initObjectShader()
{
  const vertFile = await fetch('./shaders/object.vert');
  const fragFile = await fetch('./shaders/object.frag');
  vert = await vertFile.text();
  frag = await fragFile.text();
}

function initLines()
{
  const positions = new Float32Array(lineCount * 6); // 6 values per line (x1, y1, z1, x2, y2, z2)
  const initialYPositions = new Float32Array(lineCount);
  const colors = new Float32Array(lineCount * 3); // 3 values per vertex color (r, g, b)
  const velocities = new Float32Array(lineCount);
  const accelerations = new Float32Array(lineCount);
  const lengths = new Float32Array(lineCount);

  for(let i=0; i<lineCount;++i)
  {
    const range = cameraOffsetBuffer;
    const halfRange = range * 0.5;
    const x = Math.random() * 2 * range - range;
    const y = Math.random() * range - halfRange;
    const z = Math.random() * range - halfRange;
    const length = Math.random() * (lineMaxLength - lineMinLength) + lineMinLength;
    lengths[i] = length;
    initialYPositions[i] = y;

    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x - length;
    positions[i * 6 + 4] = y; // Adjust length of the line
    positions[i * 6 + 5] = z;

    setLineColor(colors, i);

    velocities[i] = 0;
    accelerations[i] = Math.random() * 0.001 + 0.015;
  }
  lineGeo = new Three.BufferGeometry();
  lineGeo.setAttribute('position', new Three.BufferAttribute(positions, 3));
  lineGeo.setAttribute('color', new Three.BufferAttribute(colors, 3));
  lineGeo.setAttribute('velocity', new Three.BufferAttribute(velocities, 1));
  lineGeo.setAttribute('acceleration', new Three.BufferAttribute(accelerations, 1));
  lineGeo.setAttribute('length', new Three.BufferAttribute(lengths, 1));
  lineGeo.setAttribute('initialYPosition', new Three.BufferAttribute(initialYPositions, 1));

  const lineMaterial = new Three.LineBasicMaterial({ vertexColors: true, linewidth: 1 });
  lines = new Three.LineSegments(lineGeo, lineMaterial);
  scene.add(lines);
  linesExist = true;
}

function setLineColor(colorArr, i)
{
  const color = getGlobalColorVariant();
  colorArr[i * 3] = color.r; // Red
  colorArr[i * 3 + 1] = color.g; // Green
  colorArr[i * 3 + 2] = color.b; // Blue
}

function animate(time)
{
  time = isNaN(time) ? 0 : time;
  let delta = getDelta(time);
  delta = Math.min(12, Math.max(delta, 0)); 
  updateClearColorFade(time);
  updateAudioFadeIn(time);
  fadeMaterial.opacity = 1.0 - Math.pow(heavyMasterVol, 2);
  updateRush(time);
  updateCameraBump(delta);

  objects.forEach((o) =>
  {
    o.update(delta);
  });

  textObjects.forEach((t) =>
  {
    t.update(delta);
  });
  updateLines(delta)
  updateCameraRotation(time);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
  
function updateLines(delta)
{
  if(!linesExist)
  {
    return;
  }
  const positions = lineGeo.attributes.position.array;
  const velocities = lineGeo.attributes.velocity.array;
  const accelerations = lineGeo.attributes.acceleration.array;
  const lengths = lineGeo.attributes.length.array;
  const colors = lineGeo.attributes.color.array;
  const initialYPositions = lineGeo.attributes.initialYPosition.array;

  for (let i = 0; i < lineCount; ++i) 
  {
    const t = rushDirection == 1 ? rushT : 1.0 - rushT; 
    const acc = accelerations[i] + t * delta;

    velocities[i] += acc;

    positions[i * 6 + 0] -= velocities[i];//-= 0.5; // Move the start point
    positions[i * 6 + 3] -= velocities[i];//0.5; // Move the end point
    
    positions[i * 6 + 1] = initialYPositions[i] + camBump;
    positions[i * 6 + 4] = initialYPositions[i] + camBump;

    if (positions[i * 6 + 3] < -cameraOffsetBuffer) 
    {
      const startPos = Math.random() * cameraOffsetBuffer;
      positions[i * 6 + 0] = startPos;
      positions[i * 6 + 3] = startPos - lengths[i]; // Reset to initial position

      velocities[i] = 0;
      setLineColor(colors, i);
    }
  }
  lineGeo.attributes.position.needsUpdate = true; // Notify Three.js of the update
  lineGeo.attributes.color.needsUpdate = true;  
}
function checkForResize()
{
    const winW = window.innerWidth;
    const winH = window.innerHeight;  
    if(winW != currentWinRes.width || winH != currentWinRes.height)
    {
        camera.aspect = winW / winH;
        renderer.setSize(winW, winH);
        renderer.setPixelRatio(window.devicePixelRatio);
        currentWinRes.width = winW;
        currentWinRes.height = winH;
        camera.updateProjectionMatrix();
        return;
    }
}
/*---------AUDIO STREAM & SPEECH2TEXT---------*/
function initAudioParams()
{
  audioContext = new AudioContext();
  audioSelectContainer = document.querySelector('.js-audio-dev-sel');
  audioSelect = audioSelectContainer.querySelector('select#audio-source');
  audioDeviceID = audioSelect.value;
}
function initVoiceRecognition()
{ 
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.lang = currentLanguage;//"en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.start();
  isRecognitionRunning = true;
  recognition.onresult = async (event) => 
  { 
    const input = event.results[event.results.length - 1][0].transcript;
    let output = composeSearchPhrase(input);
    output = isGaneshaWaiting ? addGaneshaToPhrase(output) : output; 
    let images = await findImages(output);   
    
    if(isGaneshaWaiting)
    {
      images = shuffleArray(images.concat(ganeshaImageArray));
      playGaneshaAudio();
      isGaneshaWaiting = false;
      ganeshaImageArray = [];      
      startGaneshaFade();
    }

    const textObj = new TextObject(output, currentLanguage);
    textObjects.push(textObj);

    setGlobalColor();
    spawnObjects(images);
    if(!isRushing)
    {
      isFirstRushColor = true;
      startRush();
      startCameraRotation(); 
      startAudioChanges(rushDirection);
    }         
  };
  recognition.onspeechend = () => recognition.stop();
  recognition.onend = () => 
  { 
    recognition.lang = currentLanguage;
    recognition.start();
  };

  recognition.onnomatch = (event) => 
  {
    console.log("I didn't recognize that word.");
  };
  
  recognition.onerror = (event) => 
  {
    console.log(`Error occurred in recognition: ${event.error}`);
  };
}
function getGaneshaString()
{
  let ganesha;
  if(currentLanguage == 'en-US')
  {
   ganesha = "GANESHA!!!";
  }
  else if(currentLanguage == 'th-TH')
  {
   ganesha = "พระพิฆเนศ!!!";
  }
  else if(currentLanguage =='zh-CN')
  {
    ganesha = "象头神!!!";
  }
  else if(currentLanguage == 'ja-JP')
  {
   ganesha = "ガネーシャ！";
  }
  else if(currentLanguage == 'es-ES')
  {
   ganesha = "¡¡¡GANESHA!!!";
  }
  else if(currentLanguage == 'in-ID')
  {
   ganesha = "GANESA!!!";
  }
  else if(currentLanguage == 'fr-FR')
  {
   ganesha = "GANESH !!!"
  }
  else if(currentLanguage == 'de-DE')
  {
   ganesha = "GANESHA!!!";
  }
  else if(currentLanguage == 'es-ES')
  {
    ganesha = '¡¡¡' + ganesha; 
  }
  else if(currentLanguage == 'he-IL')
  {
    ganesha = "גנשה!!!";
  }
  else if(currentLanguage == 'nl-NL')
  {
    ganesha = "GANESHA!!!";
  }
  else if(currentLanguage == 'ru-RU')
  {
    ganesha = "ГАНЕША!!!"
  }

  return ganesha;
}
function addGaneshaToPhrase(phrase)
{
  let output = phrase;
  if(currentLanguage == 'en-US')
  {
    output += " AND GANESHA!!!";
  }
  else if(currentLanguage == 'th-TH')
  {
    output += "กับพระพิฆเนศ!!!";
  }
  else if(currentLanguage == 'ja-JP')
  {
    output += "とガネーシャ！！";
  }
  else if(currentLanguage =='zh-CN')
  {
    output += "和象头神!!!";
  }
  else if(currentLanguage == 'es-ES')
  {
    output = '¡¡¡' + phrase + " Y GANESHA!!!";
  }
  else if(currentLanguage == 'in-ID')
  {
    output += " DAN GANESA!!!";
  }
  else if(currentLanguage == 'fr-FR')
  {
    output += " ET GANESH !!!"
  }
  else if(currentLanguage == 'de-DE')
  {
    output += " UND GANESHA!!!";
  }
  else if(currentLanguage == 'he-IL')
  {
    output += " וגאנשה!!!";
  }
  else if(currentLanguage == 'nl-NL')
  {
    output += " EN GANESHA!!!";
  }
  else if(currentLanguage == 'ru-RU')
  {
    output += " И ГАНЕША!!";
  }
  return output;
}
async function startAudioStream()
{    
    const constraints =
    {
        audio: {deviceId: audioDeviceID ? {exact: audioDeviceID} : undefined},
    }
    try
    {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        window.stream = stream;
        
        return true;
    }     
    catch(error)
    {
        console.error('Error starting audio stream:', error);
        return false;
    } 
}
async function updateDeviceList() 
{
    const currentSelection = audioSelect.value; 
    const devices = await navigator.mediaDevices.enumerateDevices();
    audioSelect.innerHTML = '';
    
    devices.forEach(device => 
    {
        if (device.kind === 'audioinput') {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `mic ${audioSelect.length + 1}`;
            audioSelect.appendChild(option);
        }
    });

    if (currentSelection && audioSelect.querySelector(`option[value="${currentSelection}"]`)) 
    {
      audioSelect.value = currentSelection;
    } 
    else if (audioSelect.options.length > 0) 
    {
      audioSelect.value = audioSelect.options[0].value;
    }
    audioDeviceID = audioSelect.value;
}
async function stopStream()
{
    if(stream)
    {
        stream.getTracks().forEach(track =>
        {
            track.stop();
        });
        stream = null;
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
    }
}
/*------BING IMAGE SEARCH-----*/
function setInactivityPrompt()
{
  let prompt;
  if(currentLanguage == 'en-US')
  {
    prompt = 'say something';
  }
  else if(currentLanguage == 'th-TH')
  {
    prompt = 'พูดกับฉันสิ'
  }
  else if(currentLanguage == 'ja-JP')
  {
    prompt = 'なんか言ってよ'
  }
  else if(currentLanguage == 'fr-FR')
  {
    prompt = 'dis quelque chose'
  }
  else if(currentLanguage == 'de-DE')
  {
    prompt = 'sag doch was';
  }
  else if(currentLanguage == 'zh-CN')
  {
    prompt = '说点什么！！！';
  }
  else if(currentLanguage == 'in-ID')
  {
    prompt = 'Katakan sesuatu';
  }
  else if(currentLanguage == 'he-IL')
  {
    prompt = 'תגיד משהו';
  }
  else if(currentLanguage == 'nl-NL')
  {
    prompt = 'Zeg iets';
  }
  else if(currentLanguage == 'ru-RU')
  {
    prompt = 'Скажи что-нибудь';
  }
  inactivityPrompt.innerHTML = prompt;
}
function setLang(lang)
{
  const i = languageOptions.indexOf(lang);
  languageSelect.selectedIndex = i;
  currentLanguage = languageSelect.options[languageSelect.selectedIndex].innerHTML;
  setInactivityPrompt();
  
  console.log("current", currentLanguage);
  if(isRecognitionRunning)
  {
    recognition.stop(); //will restart automatically because of recognition.onend
  }
  if(isWorldInitialized)
  {
    clearTimeout(languageChangeTimeout);
    languageChangeDisplay.innerHTML = currentLanguage;
    languageChangeDisplay.classList.toggle('hidden', false);
    languageChangeTimeout = setTimeout(() => languageChangeDisplay.classList.toggle('hidden', true), 2000);
  }
}
function setUpLanguageSelect()
{
  languageChangeDisplay = document.querySelector('.js-language-change-display');
  languageSelectContainer = document.querySelector('.js-language-select');
  languageSelect = languageSelectContainer.querySelector('select');
  for(let i = 0; i < languageOptions.length; ++i)
  {
    const locale = document.createElement('option');
    locale.innerHTML = languageOptions[i];
    languageSelect.appendChild(locale);
    if(i == 0)
    {
      locale.selected = true;
    }
  }
  languageSelect.selectedIndex = 0;
  setLang(languageSelect.options[languageSelect.selectedIndex].innerHTML);

  languageSelect.addEventListener('change', () =>
  {    
    setLang(languageSelect.options[languageSelect.selectedIndex].innerHTML);
  });
  window.addEventListener('keypress', (e) =>
  {
    if(e.key == 'e') { setLang('en-US')}
    else if(e.key == 't') { setLang('th-TH')}
    else if(e.key == 'j') { setLang('ja-JP')}
    else if(e.key == 'i') { setLang('in-ID')}
    else if(e.key == 'f') { setLang('fr-FR')}
    else if(e.key == 'd') { setLang('de-DE')}
    else if(e.key == 's') { setLang('es-ES')}
    else if(e.key == 'c') { setLang('zh-CN')}
    else if(e.key == 'h') { setLang('he-IL')}
    else if(e.key == 'n') { setLang('nl-NL')}
    else if(e.key == 'r') { setLang('ru-RU')};    
    
  });
}

function findImages(query)
{
  const searchEndPoint = `https://api.bing.microsoft.com/v7.0/images/search?q=${query}&setLang=${currentLanguage}`;
  return new Promise((resolve) =>
  {
    fetch(searchEndPoint, 
    {
      headers: 
      {
        'Ocp-Apim-Subscription-Key': searchApiKey,

      }
    })
    .then(response => response.json())
    .then(data => 
    {
        const images = data.value.map(img => img.thumbnailUrl/*img.contentUrl*/);
        const truncImages = images.slice(0, maxSearchImages);
        resolve(truncImages);
    })
    .catch(error => console.error('Error:', error));     
  });
}
function composeSearchPhrase(wordsRaw)
{
  let input, tokenizedWords;

  if(currentLanguage == 'th-TH')
  {
    tokenizedWords = tokenize(wordsRaw);
    input = tokenizedWords.slice(0, maxInputWords).join('');
  }
  else
  {
    tokenizedWords = wordsRaw.split(' ');
    input = tokenizedWords.slice(0, maxInputWords).join(' ');    
  }
  
  const isComboWord = pastPhrases.length > 0 && Math.random() > 0.5;
  let output;
  if(isComboWord)
  {
    const oldPhrase = pastPhrases[Math.floor(Math.random() * pastPhrases.length)];
    const isOldFirst = Math.random() > 0.5;
    output = isOldFirst ? `${oldPhrase} ${input}` : `${input} ${oldPhrase}`;
  }
  else
  {
    output = input;
  }
  output = output.replace(/\./g, '');
  output = output.replace(/\。/g, '');
  output = output.toLowerCase();
  pastPhrases.push(input);
  if(pastPhrases.length > maxPastPhrases)
  {
    pastPhrases.shift();
  }

  console.log(`You said: "${output}"`);
  return output;
}