/* eslint-disable no-bitwise, camelcase, class-methods-use-this */


import { CANMessage, NMEA2000Reference } from './messages_decoder.js';

/**
 * EngineDynamicParam, the message is transferred as a fast packet. from
 */

class PGN127489_EngineDynamicParam extends CANMessage {
  engineStatus1(message) {
    const v = this.get2ByteUInt(message, 20);
    const status = [];
    if ((v & 0x01) === 0x01) status.push('Check Engine');
    if ((v & 0x02) === 0x02) status.push('Over Temperature');
    if ((v & 0x04) === 0x04) status.push('Low Oil Pressure');
    if ((v & 0x08) === 0x08) status.push('Low Oil Level');
    if ((v & 0x10) === 0x10) status.push('Low Fuel Pressure');
    if ((v & 0x20) === 0x20) status.push('Low System Voltage');
    if ((v & 0x40) === 0x40) status.push('Low Coolant Level');
    if ((v & 0x80) === 0x80) status.push('Water Flow');
    if ((v & 0x100) === 0x100) status.push('Water In Fuel');
    if ((v & 0x200) === 0x200) status.push('Charge Indicator');
    if ((v & 0x400) === 0x400) status.push('Preheat Indicator');
    if ((v & 0x800) === 0x800) status.push('High Boost Pressure');
    if ((v & 0x1000) === 0x1000) status.push('Rev Limit Exceeded');
    if ((v & 0x2000) === 0x2000) status.push('EGR System');
    if ((v & 0x4000) === 0x4000) status.push('Throttle Position Sensor');
    if ((v & 0x8000) === 0x8000) status.push('Emergency Stop');
    return status;
  }

  engineStatus2(message) {
    const v = this.get2ByteUInt(message, 22);
    const status = [];
    if ((v & 0x01) === 0x01) status.push('Warning Level 1');
    if ((v & 0x02) === 0x02) status.push('Warning Level 2');
    if ((v & 0x04) === 0x04) status.push('Power Reduction');
    if ((v & 0x08) === 0x08) status.push(' Maintenance Needed');
    if ((v & 0x10) === 0x10) status.push('Engine Comm Error');
    if ((v & 0x20) === 0x20) status.push('Sub or Secondary Throttle');
    if ((v & 0x40) === 0x40) status.push('Neutral Start Protect');
    if ((v & 0x80) === 0x80) status.push('Engine Shutting Down');
    return status;
  }

  // checked
  fromMessage(message) {
    return {
      pgn: 127489,
      src: message.source,
      count: 1,
      message: 'EngineDynamicParam',
      engineInstance: this.getByte(message, 0),
      engineOilPressure: this.get2ByteUDouble(message, 1, 100),
      engineOilTemperature: this.get2ByteUDouble(message, 3, 0.1),
      engineCoolantTemperature: this.get2ByteUDouble(message, 5, 0.01),
      alternatorVoltage: this.get2ByteDouble(message, 7, 0.01),
      fuelRate: this.get2ByteDouble(message, 9, 0.1),
      engineHours: this.get4ByteUDouble(message, 11, 1),
      engineCoolantPressure: this.get2ByteUDouble(message, 15, 100),
      engineFuelPressure: this.get2ByteUDouble(message, 17, 1000),
      reserved: this.getByte(message, 19),
      status1: this.engineStatus1(message),
      status2: this.engineStatus1(message),
      engineLoad: this.get1ByteInt(message, 24),
      engineTorque: this.get1ByteInt(message, 25),
    };
  }
}

/*
 * RapidEngineData
 */
class PGN127488_RapidEngineData extends CANMessage {
  // checked ok
  fromMessage(message) {
    return {
      pgn: 127488,
      src: message.source,
      count: 1,
      message: 'RapidEngineData',
      engineInstance: this.getByte(message, 0),
      engineSpeed: this.get2ByteUDouble(message, 1, 0.25), // RPM
      engineBoostPressure: this.get2ByteUDouble(message, 3, 100),
      engineTiltTrim: this.getByte(message, 5),
    };
  }
}
/**
 * Temperature
 */
class PGN130312_Temperature extends CANMessage {
  // checked
  fromMessage(message) {
    return {
      pgn: 130312,
      src: message.source,
      count: 1,
      message: 'Temperature',
      sid: this.getByte(message, 0),
      instance: this.getByte(message, 1),
      source: NMEA2000Reference.lookup('temperatureSource', this.getByte(message, 2)),
      actualTemperature: this.get2ByteUDouble(message, 3, 0.01),
      requestedTemperature: this.get2ByteUDouble(message, 5, 0.01),
    };
  }
}
/*
 * DC BatteryStatus
 */
class PGN127508_DCBatteryStatus extends CANMessage {
  // checked.
  fromMessage(message) {
    return {
      pgn: 127508,
      src: message.source,
      count: 1,
      message: 'DCBatteryStatus',
      instance: this.getByte(message, 0),
      batteryVoltage: this.get2ByteDouble(message, 1, 0.01),
      batteryCurrent: this.get2ByteDouble(message, 3, 0.1),
      batteryTemperature: this.get2ByteUDouble(message, 5, 0.01),
      sid: this.getByte(message, 7),
    };
  }
}
/**
 * FluidLevel
 */
class PGN127505_FluidLevel extends CANMessage {
  // checked
  fromMessage(message) {
    const b = this.getByte(message, 0);
    return {
      pgn: 127505,
      src: message.source,
      count: 1,
      message: 'FluidLevel',
      instance: b & 0x0f,
      fluidType: NMEA2000Reference.lookup('tankType', (b >> 4) & 0x0f),
      fluidLevel: this.get2ByteDouble(message, 1, 0.004),
      fluidCapacity: this.get4ByteUDouble(message, 3, 0.1),
    };
  }
}



const register = (pgnRegistry) => {
  pgnRegistry[127489] = new PGN127489_EngineDynamicParam();
  pgnRegistry[127488] = new PGN127488_RapidEngineData();
  pgnRegistry[130312] = new PGN130312_Temperature();
  pgnRegistry[127508] = new PGN127508_DCBatteryStatus();
  pgnRegistry[127505] = new PGN127505_FluidLevel();
};

export {
  register,
};
