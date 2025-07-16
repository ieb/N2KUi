/* eslint-disable no-bitwise, camelcase, class-methods-use-this */


import { CANMessage, NMEA2000Reference } from './messages_decoder.js';

/**
 * EngineDynamicParam, the message is transferred as a fast packet.
 */

class PGN65305_SingleFrameControl extends CANMessage {
  // checked
  fromMessage(message) {
    const code = this.get2ByteUInt(message, 0);
    const industryCode = code & 0x7FF;
    const industry = (code >> 13) & 0x07;
    const decoded = {
      pgn: 65305,
      src: message.source,
      industryCode,
      industry,
      message: 'Unknown SingleFrame Proprietary',
    };
    if (industryCode !== 2046 && industry !== 4) {
      return decoded;
    }
    decoded.fn = this.getByte(message, 2);
    switch (decoded.fn) {
      case 11:
        decoded.message = 'requested engine events';
        break;
      case 12:
        decoded.message = 'engine events response';
        break;
      case 13:
        decoded.message = 'clear engine events';
        break;
      case 14:
        decoded.message = 'ack clear engine events';
        break;
      default:
        decoded.message = 'Proprietary invalid functon number';
    }
    console.log("decoded ", decoded);
    return decoded;
  }

  toMessage(pgnObj) {
    if (pgnObj.pgn === 65305) {
      if (pgnObj.industryCode === 2046 && pgnObj.industry === 4) {
        const data = new DataView(new ArrayBuffer(8));
        // 0x9ffe == 2046 & 0x7FF | 0x3<<11 | 0x04<<13
        data.setUint16(0, 0x9ffe, true);
        data.setUint8(2, pgnObj.fn);
        data.setUint8(4, 0xff);
        data.setUint8(5, 0xff);
        data.setUint8(6, 0xff);
        data.setUint8(7, 0xff);
        return {
          priority: 6,
          type: 'extended',
          ts: Date.now(),
          pgn: 65305,
          // FC is invalid and prevents this message being emitted without
          // the source being updated to the gateways source address.
          // this is important for anything that needs to respond to
          // the gateway and hence this ui.
          source: 0xFC,
          destination: pgnObj.destination || 0xff,
          data,
        };
      }
    }
    return undefined;
  }
}

/*
 * Engine Custom messages
 */
class PGN130817_FastPacketResponse extends CANMessage {
  // checked ok
  fromMessage(message) {
    const code = this.get2ByteUInt(message, 0);
    const industryCode = code & 0x7FF;
    const industry = (code >> 13) & 0x07;

    const decoded = {
      pgn: 130817,
      src: message.source,
      message: 'Unknown FastPacket Proprietary',
      industryCode,
      industry,
    };
    if (industryCode !== 2046 && industry !== 4) {
      return decoded;
    }
    decoded.fn = this.getByte(message, 2);
    switch (decoded.fn) {
      case 11:
        decoded.message = 'requested engine events, invalid';
        break;
      case 12:
        decoded.message = 'engine events response';
        decoded.nevents = this.getByte(message, 3);
        decoded.events = [];
        for (let i = 0; i < decoded.nevents; i++) {
          const eventId = this.getByte(message, 4 + (i * 4));
          decoded.events.push({
            eventId: this.getByte(message, 4 + (i * 4)),
            engineEvent: NMEA2000Reference.lookup('engineEvents', eventId),
            engineHours: this.get3ByteUDouble(message, 5 + (i * 4), 0.001),
          });
        }
        break;
      case 13:
        decoded.message = 'clear engine events, invalid';
        break;
      case 14:
        decoded.message = 'ack clear engine events, invalid';
        break;
      default:
        decoded.message = 'FastPacket Proprietary invalid functon number';
        break;
    }
    console.log("decoded ", decoded);
    return decoded;
  }
}




const register = (pgnRegistry) => {
  pgnRegistry[127489] = new PGN65305_SingleFrameControl();
  pgnRegistry[130817] = new PGN130817_FastPacketResponse();
};

export {
  register,
  PGN65305_SingleFrameControl,
  PGN130817_FastPacketResponse,
};
