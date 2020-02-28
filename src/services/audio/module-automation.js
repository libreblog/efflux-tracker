/**
 * The MIT License (MIT)
 *
 * Igor Zinken 2016-2020 - https://www.igorski.nl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import Config            from '@/config';
import { rangeToIndex }  from '@/utils/array-util';
import { toHex }         from '@/utils/number-util';
import { processVoices } from './audio-util';
import { applyRouting }  from './module-router';
import { createTimer }   from './webaudio-helper';

const filterTypes = ['off', 'sine', 'square', 'sawtooth', 'triangle'];

import {
    DELAY_ENABLED, DELAY_FEEDBACK, DELAY_CUTOFF, DELAY_TIME, DELAY_OFFSET,
    EXTERNAL_EVENT, FILTER_ENABLED, FILTER_FREQ, FILTER_Q, FILTER_LFO_ENABLED,
    FILTER_LFO_SPEED, FILTER_LFO_DEPTH,
    PAN_LEFT, PAN_RIGHT, PITCH_UP, PITCH_DOWN,
    VOLUME
} from '@/definitions/automatable-parameters';

/**
 * apply a module parameter change defined inside an audioEvent during playback
 *
 * @param {AudioContext} audioContext
 * @param {AUDIO_EVENT} audioEvent
 * @param {INSTRUMENT_MODULES} modules
 * @param {INSTRUMENT} instrument
 * @param {Array<EVENT_VOICE_LIST>} instrumentEvents events currently playing back for this instrument
 * @param {number} startTimeInSeconds
 * @param {AudioGainNode} output
 * @param {Function=} optEventCallback
 */
export const applyModuleParamChange = ( audioContext, audioEvent, modules, instrument,
  instrumentEvents, startTimeInSeconds, output, optEventCallback ) => {
    switch ( audioEvent.mp.module ) {
        // gain effects
        case VOLUME:
            applyVolumeEnvelope( audioEvent, instrumentEvents, startTimeInSeconds );
            break;

        // panning effects
        case PAN_LEFT:
        case PAN_RIGHT:
            applyPanning( audioEvent, modules, startTimeInSeconds );
            break;

        // pitch effects
        case PITCH_UP:
        case PITCH_DOWN:
            applyPitchShift( audioEvent, instrumentEvents, startTimeInSeconds );
            break;

        // filter effects
        case FILTER_ENABLED:
            modules.filter.filterEnabled = ( audioEvent.mp.value >= 50 );
            applyRouting( modules, output );
            break;

        case FILTER_LFO_ENABLED:
            instrument.filter.lfoType = rangeToIndex( filterTypes, audioEvent.mp.value );
            applyRouting( modules, output );
            break;

        case FILTER_FREQ:
        case FILTER_Q:
        case FILTER_LFO_SPEED:
        case FILTER_LFO_DEPTH:
            applyFilter( audioEvent, modules, startTimeInSeconds );
            break;

        // delay effects
        case DELAY_ENABLED:
            modules.delay.delayEnabled = ( audioEvent.mp.value >= 50 );
            applyRouting( modules, output );
            break;

        case DELAY_TIME:
        case DELAY_FEEDBACK:
        case DELAY_CUTOFF:
        case DELAY_OFFSET:
            applyDelay( audioEvent, modules, startTimeInSeconds );
            break;

        // external events
        case EXTERNAL_EVENT:
            applyExternalEvent( audioContext, audioEvent, startTimeInSeconds, optEventCallback );
            break;
    }
};

/* internal methods */

function applyVolumeEnvelope( audioEvent, instrumentEvents, startTimeInSeconds ) {
    const mp = audioEvent.mp, doGlide = mp.glide,
          durationInSeconds = audioEvent.seq.mpLength,
          target = ( mp.value / 100 );

    processVoices(instrumentEvents, voice => {
        scheduleParameterChange(
            voice.gain.gain, target, startTimeInSeconds, durationInSeconds, doGlide, voice
        );
    });
}

function applyPitchShift( audioEvent, instrumentEvents, startTimeInSeconds ) {
    const mp = audioEvent.mp, doGlide = mp.glide,
        durationInSeconds = audioEvent.seq.mpLength,
        goingUp = ( mp.module === PITCH_UP );

    let generator, tmp, target;

    processVoices(instrumentEvents, voice => {
        generator = voice.generator;
        if ( generator instanceof OscillatorNode ) {
            tmp    = voice.frequency + ( voice.frequency / 1200 ); // 1200 cents == octave
            target = ( tmp * ( mp.value / 100 ));

            if ( goingUp )
                target += voice.frequency;
            else
                target = voice.frequency - ( target / 2 );

            scheduleParameterChange(
                generator.frequency, target, startTimeInSeconds, durationInSeconds, doGlide, voice
            );
        }
        else if ( generator instanceof AudioBufferSourceNode ) {
            tmp    = ( mp.value / 100 );
            target = ( goingUp ) ? generator.playbackRate.value + tmp : generator.playbackRate.value - tmp;
            scheduleParameterChange(
                generator.playbackRate, target, startTimeInSeconds, durationInSeconds, doGlide, voice
            );
        }
    });
}

function applyPanning( audioEvent, modules, startTimeInSeconds ) {
    const mp = audioEvent.mp, doGlide = mp.glide,
          durationInSeconds = audioEvent.seq.mpLength,
          target = ( mp.value / 100 );

    scheduleParameterChange(
        modules.panner.pan,
        mp.module === PAN_LEFT ? -target : target,
        startTimeInSeconds, durationInSeconds, doGlide
    );
}

function applyFilter( audioEvent, modules, startTimeInSeconds ) {
    const mp = audioEvent.mp, doGlide = mp.glide,
          durationInSeconds = audioEvent.seq.mpLength,
          module = modules.filter, target = ( mp.value / 100 );

    switch ( mp.module ) {
        case FILTER_FREQ:
            scheduleParameterChange( module.filter.frequency, target * Config.MAX_FILTER_FREQ, startTimeInSeconds, durationInSeconds, doGlide );
            break;
        case FILTER_Q:
            scheduleParameterChange( module.filter.Q, target * Config.MAX_FILTER_Q, startTimeInSeconds, durationInSeconds, doGlide );
            break;
        case FILTER_LFO_SPEED:
            scheduleParameterChange( module.lfo.frequency, target * Config.MAX_FILTER_LFO_SPEED, startTimeInSeconds, durationInSeconds, doGlide );
            break;
        case FILTER_LFO_DEPTH:
            scheduleParameterChange( module.lfoAmp.gain,
                ( target * Config.MAX_FILTER_LFO_DEPTH ) / 100 * module.filter.frequency.value,
                startTimeInSeconds, durationInSeconds, doGlide
            );
            break;
    }
}

function applyDelay( audioEvent, modules ) {
    const mp = audioEvent.mp, module = modules.delay.delay, target = ( mp.value / 100 );
    switch ( mp.module ) {
        case DELAY_TIME:
            module.delay = target; // 0 - 1 range
            break;
        case DELAY_FEEDBACK:
            module.feedback = target; // 0 - 1 range
            break;
        case DELAY_CUTOFF:
            module.cutoff = target * Config.MAX_DELAY_CUTOFF;
            break;
        case DELAY_OFFSET:
            module.offset = Config.MIN_DELAY_OFFSET + target; // -0.5 - 0.5 range
            break;
    }
}

function applyExternalEvent( audioContext, event, startTimeInSeconds, eventCallback ) {
    if ( !eventCallback ) {
        return;
    }
    createTimer( audioContext, startTimeInSeconds, () => {
        // within Efflux values are scaled to percentile, here we
        // convert the on-screen value to the same hexadecimal value
        eventCallback(parseInt(`0x${toHex(event.mp.value)}`, 16));
    });
}

/**
 * @param {AudioParam} param the AudioParam whose value to change
 * @param {number} value the target value for the AudioParam
 * @param {number} startTimeInSeconds relative to the currentTime of the AudioContext, when the change should take place
 * @param {number=} durationInSeconds the total duration of the change (only rqeuired when 'doGlide' is true)
 * @param {boolean=} doGlide whether to "glide" to the value (linear change), defaults to false for instant change
 * @param {Object=} data optional data Object to track the status of the scheduled parameter changes (can for instance
 *                  be EVENT_VOICE_LIST which shouldn't cancel previously scheduled changes upon repeated invocation)
 */
function scheduleParameterChange( param, value, startTimeInSeconds, durationInSeconds, doGlide, data ) {
    if ( !doGlide || ( data && !data.gliding )) {
        param.cancelScheduledValues( startTimeInSeconds );
        param.setValueAtTime(( doGlide ) ? param.value : value, startTimeInSeconds );
    }
    if ( doGlide ) {
        param.linearRampToValueAtTime( value, startTimeInSeconds + durationInSeconds );
        if ( data )
            data.gliding = true;
    }
}