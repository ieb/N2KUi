/* eslint-disable no-underscore-dangle */

import { NMEA2000MessageDecoder } from './n2k/messages_decoder.js';
import { register as registerIsoMessages } from './n2k/messages_iso.js';
import { register as registerEngineMessages } from './n2k/messages_engine.js';
import { register as registerNavMessages } from './n2k/messages_nav.js';
import { register as registerPropMessages } from './n2k/messages_prop.js';
import { EventEmitter } from './eventemitter.js';

import { Calculations } from './n2k/calculations.js';

import { LinearHistory, AngularHistory } from './histories.js';


// $PCDIN,01FF0D,0001B5F4,0F,FE9F010300*29
// $PCDIN,FF19,197AB2E9288,FC,FE9F0B00FFFFFFFF,13

class SeaSmartEncoder {
  static encode(msg) {
    const encoded = [];
    encoded.push('$PCDIN');
    encoded.push(msg.pgn.toString(16).padStart(6, '0').toUpperCase());
    encoded.push(msg.ts.toString(16).substring(0, 8).toUpperCase());
    encoded.push(msg.source.toString(16).padStart(2, '0').toUpperCase());
    encoded.push(SeaSmartEncoder._fromBuffer(msg.data));
    const sentence = encoded.join(',');
    return `${sentence}*${SeaSmartEncoder._checkSum(sentence)}`;
  }

  static _checkSum(sentence) {
    let cs = 0;
    for (let i = 1; i < sentence.length; i++) {
      /* eslint-disable-next-line no-bitwise */
      cs ^= sentence.charCodeAt(i);
    }
    return cs.toString(16).padStart(2, '0').toUpperCase();
  }

  static _fromBuffer(data) {
    let s = '';
    for (let i = 0; i < data.byteLength; i++) {
      s += data.getUint8(i).toString(16).padStart(2, '0').toUpperCase();
    }
    return s;
  }
}


class SeaSmartParser extends EventEmitter {
  constructor(decoder) {
    super();
    this.decoder = decoder;
  }

  parseSeaSmartMessages(messages) {
    if (messages !== undefined && messages.data) {
      const sentences = messages.data.split('\n');
      for (let i = 0; i < sentences.length; i++) {
        const ssMessage = sentences[i].trim();
        const canMessage = SeaSmartParser._parseSeaSmart(ssMessage);
        if (canMessage !== undefined) {
          this.emit('n2kraw', canMessage);
          const decoded = this.decoder.decode(canMessage);
          if (decoded !== undefined) {
            this.emit('n2kdecoded', decoded);
          }
        }
      }
    }
  }

  static _parseSeaSmart(sentence) {
    if (sentence.startsWith('$PCDIN,') && SeaSmartParser._checkSumOk(sentence)) {
      const parts = sentence.substring(0, sentence.length - 3).split(',');
      const canMessage = {
        // hex encoded 24 bit PGN, 3 bytes, bigendian ??? wtf?
        pgn: SeaSmartParser._toUint(parts[1]),
        timetamp: SeaSmartParser._toUint(parts[2]),
        source: SeaSmartParser._toUint(parts[3]),
        data: new DataView(SeaSmartParser._toBuffer(parts[4])),
      };
      return canMessage;
    }
    return undefined;
  }

  //
  static _toUint(asHex) {
    if ((asHex.length % 2) === 1) {
      return parseInt(`0${asHex}`, 16);
    }
    return parseInt(asHex, 16);
  }

  static _toBuffer(asHex) {
    const b = new Uint8Array(asHex.length / 2);
    for (let i = 0; i < b.length; i++) {
      b[i] = parseInt(asHex.substring(i * 2, i * 2 + 2), 16);
    }
    return b.buffer;
  }

  static _checkSumOk(sentence) {
    let cs = 0;
    for (let i = 1; i < sentence.length - 3; i++) {
      /* eslint-disable-next-line no-bitwise */
      cs ^= sentence.charCodeAt(i);
    }
    const csCheck = cs.toString(16).padStart(2, '0').toUpperCase();
    const csSentence = sentence.substring(sentence.length - 2);
    if (csCheck === csSentence) {
      return true;
    }
    // eslint-disable-next-line no-console
    console.log('SeaSmart message checksum failed ', csCheck, sentence);
    return false;
  }
}


/**
 * Internal class that manages a chunked stream handling restarts and timeouts.
 * Once started it will run until stopped.
 * Cannot be restarted once stopped.
 * Cannot be started again once started.
 * public methods are start and stop.
 * emits events:
 *   connected, true or false
 *   statusCode with the status code of the current fetch after a response is received.
 *   metrics, are metrics.
 *   statusUpdate the BLE status updates.
 *
 *
 */
class ChunkedSeaSmartStream extends EventEmitter {
  constructor(url, seasmartParser) {
    super();
    this.seasmartParser = seasmartParser;
    this.running = false;
    this.timeouts = 0;
    this.connections = 0;
    this.url = url;
  }


  /*
   * started goes from false to true, but is never reset.
   * once started, running is set to true, and then false, never reset.
   * end state is started == true and running == false.
   *
   */
  start() {
    if (!this.started) {
      this.started = true;
      this.running = true;
      this.restartDelay = 5000;
      this.streamId = Date.now();
      this.restart();
      const that = this;

      const timeoutCheck = setInterval(() => {
        if (that.running) {
          console.debug(`${Date.now()} ${this.streamId} Timeout `, (Date.now() - that.lastMessage));
          if ((Date.now() - that.lastMessage) > 10000) {
            // eslint-disable-next-line no-console
            that.restartDelay = 100;
            that.controller.abort('timeout');
            that.timeouts++;
            console.log(`${Date.now()} ${this.streamId} Timeout on receive, trigger restart`);
          }
        } else {
          clearInterval(timeoutCheck);
        }
      }, 1000);
    }
  }

  stop() {
    console.log(`${Date.now()} ${this.streamId} Stopping`);
    const that = this;
    return new Promise((resolve) => {
      if (that.running) {
        that.addListener('connected', (connected) => {
          if (!connected) {
            console.log(`${Date.now()} ${that.streamId} Stopped, even connected == false`);
            resolve();
          }
        });
        that.running = false;
        console.log(`${Date.now()} ${that.streamId} Signalling stop `, that.running);
        that.controller.abort('stopped');
        console.log(`${Date.now()} ${that.streamId} Signaled stop `, that.running);
      } else {
        console.log(`${Date.now()} ${that.streamId} Already stopped `, that.running);
        resolve();
      }
    });
  }


  // restarts the connection.
  restart() {
    if (!this.running) {
      this.emit('connected', false);
      return;
    }
    const that = this;
    this.keepRunning().then(() => {
      if (that.running) {
        console.log(`${Date.now()} ${that.streamId} Schedule Normal Restart in ${that.restartDelay}`);
        setTimeout(() => {
          that.restartDelay = 5000;
          that.restart();
        }, that.restartDelay);
      } else {
        console.log(`${Date.now()} ${that.streamId} No Restart`);
      }
    }).catch((e) => {
      console.log(`${Date.now()} ${that.streamId} Fetch Error `, e);
      if (e.message === 'Failed to fetch') {
        // net::ERR_CONNECTION_REFUSED
        that.running = false;
        that.emit('statusCode', 504);
        console.log(`${Date.now()} ${that.streamId} No Restart`);
      } else if (that.running) {
        console.log(`${Date.now()} ${that.streamId} Schedule Error Restart in ${that.restartDelay}`);
        setTimeout(() => {
          that.restartDelay = 5000;
          that.restart();
        }, that.restartDelay);
      } else {
        that.running = false;
        that.emit('connected', false);
        console.log(`${Date.now()} ${that.streamId} No Restart`);
      }
    });
  }

  // the running stream to be kept running at all costs.
  async keepRunning() {
    console.log(`${Date.now()} ${this.streamId} Start keepRunning`);
    this.lastMessage = Date.now();
    this.controller = new AbortController();
    this.connections++;
    const response = await fetch(this.url, { signal: this.controller.signal });
    console.log(`${Date.now()} ${this.streamId} Connected keepRunning`);
    this.emit('statusCode', response.status);
    this.emit('connected', true);
    let buffer = '';
    const that = this;
    // this loop will pause when there is nothing on the http stream,
    // which blocks any
    for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
      if (!that.running) {
        break;
      }
      // Do something with each "chunk"
      // the chunk may be incomplete, so we need the parser to return what it didnt parse.
      buffer += chunk;
      that.lastMessage = Date.now();
      const lastNL = buffer.lastIndexOf('\n');
      if (lastNL !== -1) {
        try {
          that.seasmartParser.parseSeaSmartMessages({ data: buffer.substring(0, lastNL + 1) });
        } catch (e) {
          console.error('Failed tp parse message ', e, buffer.substring(0, lastNL + 1));
        }
        buffer = buffer.substring(lastNL + 1);
      }
    }
    that.emit('connected', false);
    console.log(`${Date.now()} ${this.streamId} End keepRunning`);
  }
}


/**
 * Read registers from a http seasmart stream of DCIM sentences.
 * This requires no special permissions once the http service has been found.
 *
 */
class SeaSmartReader extends EventEmitter {
  constructor(parser) {
    super();
    this.streamCount = 0;
    this.messagesRecieved = 0;
    this.messagedDecoded = 0;
    this.parser = parser;
    const that = this;
    // eslint-disable-next-line no-unused-vars
    this.parser.addListener('n2kraw', (rawMessage) => {
      this.messagesRecieved++;
    });
    // eslint-disable-next-line no-unused-vars
    this.parser.addListener('n2kdecoded', (decodedMessage) => {
      this.messagedDecoded++;
    });
    setInterval(() => {
      that.emit('metrics', {
        messagesRecieved: that.messagesRecieved,
        messagedDecoded: that.messagedDecoded,
        streams: that.streamCount,
        connections: (that.stream) ? that.stream.connections : undefined,
        timeouts: (that.stream) ? that.stream.timeouts : undefined,
      });
    }, 1000);
  }

  async start(url) {
    if (!this.stream) {
      console.log('Starting connection to ', url);
      this.streamCount++;
      this.stream = new ChunkedSeaSmartStream(url, this.parser);
      const that = this;
      this.stream.addListener('*', (event, v) => {
        that.emit(event, v);
      });
      this.stream.start();
    } else {
      console.log('Already connected');
    }
  }

  async stop() {
    this.url = undefined;
    if (this.stream) {
      await this.stream.stop();
      console.log('Stopped');
    }
    this.stream = undefined;
  }
}

class Store extends EventEmitter {
  constructor() {
    super();
    this.state = {
      lastChange: Date.now(),
    };
    this.messages = {};
    // last time a valid update was recieved.
    // not all messages need this.
    this.lastUpdate = {};
    this.history = {
      awa: new AngularHistory(),
      aws: new LinearHistory(),
      tws: new LinearHistory(),
      twa: new AngularHistory(),
      stw: new LinearHistory(),
      cogt: new AngularHistory(),
      cogm: new AngularHistory(),
      sog: new LinearHistory(),
      hdt: new AngularHistory(),
      hdm: new AngularHistory(),
      gwdt: new AngularHistory(),
      gwdm: new AngularHistory(),
      vmg: new LinearHistory(),
      roll: new AngularHistory(),
      leeway: new AngularHistory(),
      variation: new AngularHistory(),
      polarSpeed: new LinearHistory(),
      polarSpeedRatio: new LinearHistory(),
      polarVmg: new LinearHistory(),
      targetVmg: new LinearHistory(),
      targetStw: new LinearHistory(),
      targetTwa: new AngularHistory(),
      targetAwa: new AngularHistory(),
      targetAws: new LinearHistory(),
      polarVmgRatio: new LinearHistory(),
      oppositeHeadingTrue: new AngularHistory(),
      oppositeTrackTrue: new AngularHistory(),
      oppositeTrackMagnetic: new AngularHistory(),
      oppositeHeadingMagnetic: new AngularHistory(),
      dbt: new LinearHistory(),
      alternatorVoltage_0: new LinearHistory(),
      atmosphericPressure_0: new LinearHistory(),
      atmosphericPressure_1: new LinearHistory(),
      atmosphericPressure_2: new LinearHistory(),
      current_0: new LinearHistory(),
      current_1: new LinearHistory(),
      engineCoolantTemperature_0: new LinearHistory(),
      fuelCapacity_0: new LinearHistory(),
      temperature_0: new LinearHistory(),
      voltage_0: new LinearHistory(),
      voltage_1: new LinearHistory(),

    };
    this.webContents = [];

    // Store API exposed to the UI.
    this.getState = this.getState.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getKeys = this.getKeys.bind(this);
  }

  /*  Exposed API methods */
  getState(field) {
    return this.state[field];
  }

  getHistory(field) {
    if (this.history[field]) {
      return this.history[field];
    }
    return { value: 0, data: [] };
  }

  getKeys() {
    return Object.keys(this.state);
  }

  /* Non exposed API methods */

  // When using a NMEA0183 feed.
  updateFromNMEA0183Stream(sentence) {
    const newState = {};
    switch (sentence.id) {
      case 'MWV':
        if (sentence.fields[4] === 'A' && sentence.fields[1] === 'R' && sentence.fields[3] === 'N') {
          newState.awa = sentence.fields[0] * (Math.PI / 180);
          newState.aws = sentence.fields[2] * 0.514444;
        }
        break;
      case 'ROL':
        newState.roll = sentence.fields[0] * (Math.PI / 180);
        break;
      case 'VHW':
        newState.hdm = sentence.fields[2] * (Math.PI / 180);
        newState.stw = sentence.fields[4] * 0.514444;
        break;
      case 'HDG':
        newState.hdm = sentence.fields[0] * (Math.PI / 180);
        newState.variation = sentence.fields[3] * (Math.PI / 180);
        if (sentence.fields[4] === 'W') {
          newState.variation = -newState.variation;
        }
        break;
      case 'VTG':
        newState.cogt = sentence.fields[0] * (Math.PI / 180);
        newState.sog = sentence.fields[4] * 0.514444;
        break;
      default:
        break;
    }
    const now = Date.now();
    const changedState = {};
    for (const k in newState) {
      if (newState[k] !== this.state[k]) {
        this.state.lastChange = now;
        this.state[k] = newState[k];
        changedState[k] = {
          state: this.state[k],
          history: this.history[k],
        };
      }
    }
    this.emit('change', changedState);
  }

  // When streaming NMEA2000 messages.
  updateFromNMEA2000Stream(message) {
    // only messages where there is a value in putting them into the store\
    // should be added to the store. Forother messages simply subscribe directly to the message
    // in the visualisation. (how TBD)
    // Reasoning, is to mimimise CPU usage by not doing unecessary work that isnt used.
    const newState = {};
    const now = Date.now();

    switch (message.pgn) {
      case 127250: // Heading
        if (message.ref.name === 'Magnetic') {
          newState.hdm = message.heading;
          if (this.state.variationSource === undefined) {
            newState.variation = message.variation;
          }
          newState.deviation = message.deviation;
        }
        break;
      case 127257: // attitude
        newState.yaw = message.yaw;
        newState.pitch = message.pitch;
        newState.roll = message.roll;
        break;
      case 127258: // variation
        // Use heading message
        // {"pgn":127258,"src":30,"count":906,"message":"N2K Magnetic Variation",
        // "sid":89,"source":{"id":8,"name":"wmm2020"},"daysSince1970":19827,
        // "variation":0.219}

        if (this.state.variationSource === undefined
                    || (message.source
                         && message.source.p >= this.state.variationSource.p)) {
          newState.variation = message.variation;
          newState.variationdaysSince1970 = message.daysSince1970;
          newState.variationSource = message.source;
        }
        break;
      case 128259: // speed
        newState.stw = message.waterReferenced;
        newState.speedGroundReferenced = message.groundReferenced;
        newState.swrt = message.swrt;
        break;
      case 128267: // depth
        newState.dbt = message.depthBelowTransducer;
        newState.depthOffset = message.offset;
        break;
      case 128275: // log
        // newState.logSecondsSinceMidnight = message.secondsSinceMidnight;
        // newState.logDaysSince1970 = message.daysSince1970;
        newState.log = message.log;
        newState.tripLog = message.tripLog;
        break;
      case 129025: // rapid possition
        // {"pgn":129025,"src":30,"count":5242,"message":"N2K Rapid Positions",
        // "latitude":51.9589473,"longitude":1.2762917999999999}
        if (message.src === this.state.gnssSource) {
          newState.latitude = message.latitude;
          newState.longitude = message.longitude;
        }
        break;
      case 129026: // sog cog rapid
        if (message.src === this.state.gnssSource) {
          if (message.ref.name === 'True') {
            newState.cogt = message.cog;
            newState.sog = message.sog;
          } else if (message.ref.name === 'Magnetic') {
            newState.cogx = message.cog;
            newState.sog = message.sog;
          }
        }
        break;
      case 129029: // GNSS
        // if a more complete view of GNSS is required, then create a subscriber to the
        // messages directly.
        // use the most prefered source available.
        // this will also select other messages from the gnss source.
        if (this.state.GNSStype === undefined
                    || (message.GNSStype && message.GNSStype.p >= this.state.GNSStype.p)) {
          newState.GNSStype = message.GNSStype;
          newState.gnssSource = message.src;
          newState.latitude = message.latitude;
          newState.longitude = message.longitude;
          newState.gnssIntegrety = message.integrety;
          newState.gpsDaysSince1970 = message.daysSince1970;
          newState.gpsSecondsSinceMidnight = message.secondsSinceMidnight;
          newState.gnssLastUpdate = now;
        } else {
          return; // dont save message as its come from an untrusted gnss source with
          // an unrecognized GNSS type
        }
        break;
      case 126992: // System time
        // Use GNSS message
        // if ( message.timeSource.name === "GPS") {
        //    newState.systemDate = message.systemDate;
        //    newState.systemTime = message.systemTime;
        // }
        break;
      case 129283: // XTE
        // ignore for now.
        break;
      case 130306: // wind
        if (message.windReference.name === 'Apparent') {
          newState.aws = message.windSpeed;
          newState.awa = message.windAngle;
        } else if (message.windReference.name === 'True') {
          newState.tws = message.windSpeed;
          newState.twa = message.windAngle;
        }
        break;

        /* {"pgn":130577,"count":1,"message":"Direction Data",
        "residualMode":{"id":0,"name":"Autonomous"},
        "cogReference":{"id":0,"name":"True"},
        "sid":223,"cog":-1000000000,"sog":-1000000000,
        "heading":-1000000000,"stw":-1000000000,
        "set":3.0094000000000003,"drift":0.27}
*/

      case 130557: // direction data, set and drift
        if (message.cogReference.name === 'Magnetic') {
          newState.setM = message.set;
          newState.drift = message.drift;
        } else if (message.cogReference.name === 'True') {
          newState.setT = message.set;
          newState.drift = message.drift;
        }
        break;
      case 127506: // DC Status

        /*
        {"pgn":127506,"src":15,"count":255,"message":"N2K DC Status","sid":192,"dcInstance":1,
          "dcType":{"id":0,"name":"Battery"},
          "stateOfCharge":89,
          "stateOfHealth":95,
          "timeRemaining":3932040,
          "rippleVoltage":-1000000000,
          "capacity":1026000}
          */
        newState.service_battery_stateOfCharge = message.stateOfCharge;
        newState.service_battery_stateOfHealth = message.stateOfHealth;
        newState.service_battery_timeRemaining = message.timeRemaining;
        newState.service_battery_rippleVoltage = message.rippleVoltage;
        newState.service_battery_capacity = message.capacity;


        // ignore for now, may be able to get from LifePO4 BT adapter
        break;
      case 127508: // DC Bat status
        if (message.instance === 0) {
          newState.engine_battery_voltage = message.batteryVoltage;
          newState.engine_battery_current = message.batteryCurrent;
          newState.engine_battery_temperature = message.batteryTemperature;
        } else if (message.instance === 1) {
          newState.service_battery_voltage = message.batteryVoltage;
          newState.service_battery_current = message.batteryCurrent;
          newState.service_battery_temperature = message.batteryTemperature;
        } else if (message.instance === 2) {
          newState.alternator_battery_voltage = message.batteryVoltage;
          newState.alternator_battery_current = message.batteryCurrent;
          newState.alternator_battery_temperature = message.batteryTemperature;
        } else {
          newState[`battery_${message.instance}_voltage`] = message.batteryVoltage;
          newState[`battery_${message.instance}_current`] = message.batteryCurrent;
          newState[`battery_${message.instance}_temperature`] = message.batteryTemperature;
        }
        break;
      case 130312: // temp

        /*

        "temperatureSource": {
            0: { id: 0, name:"Sea Temperature"},
            1: { id: 1, name:"Outside Temperature"},
            2: { id: 2, name:"Inside Temperature"},
            3: { id: 3, name:"Engine Room Temperature"},
            4: { id: 4, name:"Main Cabin Temperature"},
            5: { id: 5, name:"Live Well Temperature"},
            6: { id: 6, name:"Bait Well Temperature"},
            7: { id: 7, name:"Refrigeration Temperature"},
            8: { id: 8, name:"Heating System Temperature"},
            9: { id: 9, name:"Dew Point Temperature"},
            10: { id: 10, name:"Apparent Wind Chill Temperature"},
            11: { id: 11, name:"Theoretical Wind Chill Temperature"},
            12: { id: 12, name:"Heat Index Temperature"},
            13: { id: 13, name:"Freezer Temperature"},
            14: { id: 14, name:"Exhaust Gas Temperature"},
            15: { id: 15, name:"Shaft Seal Temperature"},
        },

                        return  {
            pgn: 130312,
            message: "Temperature",
            sid: this.getByte(message,0),
            instance: this.getByte(message,1),
            source: NMEA2000Reference.lookup("temperatureSource",this.getByte(message,2)),
            actualTemperature: this.get2ByteUDouble(message, 3,0.01),
            requestedTemperature: this.get2ByteUDouble(message, 5,0.01)
        };
*/
        newState[`${message.source.name}`] = message.actualTemperature;
        break;
      case 127505: // fluid level
        if (message.fluidType.name === 'Fuel') {
          newState[`fuelLevel_${message.instance}`] = message.fluidLevel;
          newState[`fuelCapacity_${message.instance}`] = message.fluidCapacity;
        }
        break;
      case 127489: // Engine Dynamic params
        // ignore most fields for storage
        newState[`engineCoolantTemperature_${message.engineInstance}`] = message.engineCoolantTemperature;
        newState[`alternatorVoltage_${message.engineInstance}`] = message.alternatorVoltage;
        // this is an abuse, specific to my boat which has LiFePo4 and the
        // oil temperature sensor is on the alternator to warn of overheating.
        newState[`alternatorTemperature_${message.engineInstance}`] = message.engineOilTemperature;
        break;
      case 127488: // Engine Rapiod
        newState[`engineSpeed_${message.engineInstance}`] = message.engineSpeed;
        break;
      case 130314: // pressure
        if (message.pressureSource.name === 'Atmospheric') {
          newState[`atmosphericPressure_${message.pressureInstance}`] = message.actualPressure;
        }
        break;
      case 127245: // rudder
        // sometimes multiple rudder sources cause the possition to flip.
        if (message.rudderPosition !== -1e9) {
          newState.rudderPosition = message.rudderPosition;
          this.lastUpdate[127245] = now;
        } else if (this.lastUpdate[127245] === undefined) {
          newState.rudderPosition = -1e9;
        } else if ((now - this.state[127245]) > 10000) {
          newState.rudderPosition = -1e9;
        }
        break;
      case 130817: // proprietary fast packed, engine events
        if (message.fn === 12) {
          newState.engineEvents = message.events;
          console.log("got", newState);
          this.lastUpdate[130817] = now;
        }
        break;
      default:
        break;
    }
    if (this.messages[message.pgn] !== undefined) {
      message.count = this.messages[message.pgn].count + 1;
    }
    this.messages[message.pgn] = message;

    this.emit('newstate', newState);
    this.updateState(newState);
  }

  updateState(newState) {
    const now = Date.now();
    const changedState = {};
    for (const k of Object.keys(newState)) {
      if (newState[k] !== this.state[k]) {
        this.state.lastChange = now;
        this.state[k] = newState[k];
        changedState[k] = {
          state: this.state[k],
          history: this.history[k],
        };
      }
    }
    this.emit('change', changedState);
  }

  emitAll() {
    const currentState = {};
    for (const k of Object.keys(this.state)) {
      currentState[k] = {
        state: this.state[k],
        history: this.history[k],
      };
    }
    this.emit('change', currentState);
  }

  getMessages() {
    return this.messages;
  }

  mergeUpdate(calculations) {
    const now = Date.now();
    const changedState = {};
    // calculate new values based on the store before updating history.
    const calculatedValues = calculations.update(this);
    for (const k in calculatedValues) {
      if (calculatedValues[k] !== this.state[k]) {
        this.state.lastChange = now;
        this.state[k] = calculatedValues[k];
        changedState[k] = {
          state: this.state[k],
          history: this.history[k],
        };
      }
    }
    this.updateHistory();
    this.emit('change', changedState);
  }

  updateHistory() {
    for (const k of Object.keys(this.history)) {
      this.history[k].updateSample(this.state[k]);
    }
  }
}



class StoreAPIImpl {
  constructor() {
    this.store = new Store();
    this.calculations = new Calculations();
    this.decoder = new NMEA2000MessageDecoder();
    registerIsoMessages(this.decoder.messages);
    registerIsoMessages(this.decoder.messages);
    registerEngineMessages(this.decoder.messages);
    registerNavMessages(this.decoder.messages);
    registerPropMessages(this.decoder.messages);

    this.seasmartParser = new SeaSmartParser(this.decoder);
    this.messageCount = 0;
    this.seasmartParser.addListener('n2kdecoded', (decoded) => {
      this.messageCount++;
      this.store.updateFromNMEA2000Stream(decoded);
    });
    setInterval(() => {
      this.store.mergeUpdate(this.calculations);
    }, 1000);
  }

  getParser() {
    return this.seasmartParser;
  }

  getPacketsRecieved() {
    return this.messageCount;
  }

  emitAll() {
    this.store.emitAll();
  }

  getState(field) {
    return this.store.getState(field);
  }

  getHistory(field) {
    return this.store.getHistory(field);
  }

  getStore() {
    return this.store;
  }

  getKeys() {
    return this.store.getKeys();
  }

  getMessages() {
    return this.store.getMessages();
  }

  addListener(event, fn) {
    if (event.startsWith('n2k')) {
      this.seasmartParser.addListener(event, fn);
    } else {
      this.store.addListener(event, fn);
    }
  }

  removeListener(event, fn) {
    if (event.startsWith('n2k')) {
      this.seasmartParser.removeListener(event, fn);
    } else {
      this.store.removeListener(event, fn);
    }
  }

  getNmea0183Address() {
    return this.host;
  }

  /* eslint-disable-next-line class-methods-use-this */
  getConnectedClients() {
    return '';
  }
}




export { StoreAPIImpl, SeaSmartReader, SeaSmartEncoder };
