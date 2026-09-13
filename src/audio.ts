export { Metronome } from './audio/metronome'
export { listenForOnsets, type AudioLevel, type DetectedAttack } from './audio/onsetDetection'
export {
    defaultDetectorParameters,
    getAudioCalibration,
    saveAudioCalibration,
    type AudioCalibration,
    type DetectorParameters,
} from './audio/calibration'
export { playRhythmPattern } from './audio/guitarPreview'
