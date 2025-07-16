import { h, Component } from './deps/preact/preact.module.js';
import htm from './deps/htm/index.module.js';
import { DataTypes } from './datatypes.js';
import { AdminRequest, AdminCredentals } from './admin.js';

const html = htm.bind(h);

const status1Mask = [
  { mask: 0x01, name: 'Check Engine' },
  { mask: 0x02, name: 'Over Temperature' },
  { mask: 0x04, name: 'Low Oil Pressure' },
  { mask: 0x08, name: 'Low Oil Level' },
  { mask: 0x10, name: 'Low Fuel Pressure' },
  { mask: 0x20, name: 'Low System Voltage' },
  { mask: 0x40, name: 'Low Coolant Level' },
  { mask: 0x100, name: 'Water In Fuel' },
  { mask: 0x200, name: 'Charge Indicator' },
  { mask: 0x400, name: 'Preheat Indicator' },
  { mask: 0x800, name: 'High Boost Pressure' },
  { mask: 0x1000, name: 'Rev Limit Exceeded' },
  { mask: 0x2000, name: 'EGR System' },
  { mask: 0x4000, name: 'Throttle Position Sensor' },
  { mask: 0x8000, name: 'Emergency Stop' },
];
const status2Mask = [
  { mask: 0x01, name: 'Warning Level 1' },
  { mask: 0x02, name: 'Warning Level 2' },
  { mask: 0x04, name: 'Power Reduction' },
  { mask: 0x08, name: ' Maintenance Needed' },
  { mask: 0x10, name: 'Engine Comm Error' },
  { mask: 0x20, name: 'Sub or Secondary Throttle' },
  { mask: 0x40, name: 'Neutral Start Protect' },
  { mask: 0x80, name: 'Engine Shutting Down' },
];


class EngineView extends Component {
  constructor(props) {
    super(props);
    this.props = props;
    this.apiUrl = props.apiUrl;
    this.commandHandler = props.commandHandler;
    this.title = 'EngineView';
    this.storeAPI = props.storeAPI;
    this.loadFreezeFrames = this.loadFreezeFrames.bind(this);
    this.updateDisplayState = this.updateDisplayState.bind(this);
    this.requestEngineEvents = this.requestEngineEvents.bind(this);
    this.authenticated = this.authenticated.bind(this);
    // eslint-disable-next-line no-unused-vars
    const testEvents = [
      { eventId: 1, engineEvent: { id: 1, name: 'Engine Stop' }, engineHours: 0.042 },
      { eventId: 2, engineEvent: { id: 2, name: 'Low Oil Pressure' }, engineHours: 0.083 },
      { eventId: 3, engineEvent: { id: 3, name: 'High Coolant Temperature' }, engineHours: 0.125 },
      { eventId: 4, engineEvent: { id: 4, name: 'High Exhaust Temperature' }, engineHours: 0.167 },
      { eventId: 5, engineEvent: { id: 0, name: 'Current Hours' }, engineHours: 0.89 },
    ];
    // eslint-disable-next-line no-unused-vars
    const testLog = this.parseLog([
      'time,logTime,lat,long,log,engineHours,status1,status2,rpm,coolantTemp,exhaustT,oilPress,alternatorT,altenatorV,engineBatteryV,serviceBatteryV,serviceBatteryA,serviceBatteryT,engineRoomT,senseT1,senseT2,senseT3,senseT4',
      '1981-08-21T15:45:04Z,367256704,,,,,0,0,,-1000000273.1,-1000000273.1,,-20.0,,4.47,,,-273.2,-20.0,21.1,21.2,21.2,-1000000273.1',
      '1981-08-21T15:45:04Z,367256704,,,,,0,0,,,,,-20.0,,4.44,,,-273.2,-20.0,21.1,21.2,21.2,',
      '1981-08-21T15:45:04Z,367256704,,,,0.01,512,0,999,,,74.636555,,0.00,4.22,,,-273.2,-20.0,26.5,26.3,27.3,',
      '1981-08-21T15:45:04Z,367256704,,,,0.01,544,0,1000,,,74.491517,,0.00,4.24,,,-273.2,-20.0,26.5,26.3,27.3,',
    ].join('\n'));
    this.state = {
      adminConnected: false,
      engineEvents: [],
      freezeFrames: [],
    };
  }

  // eslint-disable-next-line class-methods-use-this
  parseLog(freezeFrameFile) {
    const log = freezeFrameFile.split('\n');
    const headings = log[0].split(',');
    const freezeFrames = [];
    for (let i = 1; i < log.length; i++) {
      const frame = {};
      const values = log[i].split(',');
      for (let j = 0; j < headings.length; j++) {
        frame[headings[j]] = values[j];
      }
      freezeFrames.push(frame);
    }
    return freezeFrames;
  }


  componentDidMount() {
    this.updateDisplayState({
      engineEvents: this.storeAPI.getState('engineEvents'),
    });
    this.storeAPI.addListener('change', this.updateDisplayState);
    this.loadFreezeFrames();
  }

  componentWillUnmount() {
    this.storeAPI.removeListener('change', this.updateDisplayState);
  }




  /*
{"pgn":130817,"src":24,"message":"engine events response","industryCode":2046,"industry":3,"fn":12,

"nevents":4,

"events":[{"eventId":1,"engineEvent":{"id":1,"name":"Engine Stop"},"engineHours":0.042},{"eventId":2,"engineEvent":{"id":2,"name":"Low Oil Pressure"},"engineHours":0.083},{"eventId":3,"engineEvent":{"id":3,"name":"High Coolant Temperature"},"engineHours":0.125},{"eventId":4,"engineEvent":{"id":4,"name":"High Exhaust Temperature"},"engineHours":0.167}]}
*/



  showEngineEvents() {
    const { dataTypes } = DataTypes;
    const engineEvents = this.state.engineEvents.map((f) => html`<div className="event">
        <div>${dataTypes.engineHours.display(f.engineHours)}</div>
        <div>${f.engineEvent.name}</div>
    </div>`);
    engineEvents.unshift(html`<div className="event-header">
          <div>Hours</div>
          <div>Event</div>
      </div>`);
    return html`<div className="events">${engineEvents}</div>`;
  }

  // eslint-disable-next-line class-methods-use-this
  decodeBm(statusBm, bitMasks) {
    if (statusBm === undefined || statusBm === -1E9 || statusBm === '' || +statusBm === 0) {
      return html`<div className="status">-</div>`;
    }
    const status = [];
    bitMasks.forEach((v) => {
      // eslint-disable-next-line no-bitwise
      if ((statusBm & v.mask) === v.mask) {
        status.push(html`<div>${v.name}</div>`);
      }
    });
    return html`<div className="status">${status}</div>`;
  }

  showFreezeFrames() {
    if (this.state.adminConnected) {
      const { dataTypes } = DataTypes;
      const feedback = this.state.freezeFrames.map((f) => html`<div className="frame">
            <div>${dataTypes.engineHours.display(f.engineHours)}</div>
            ${this.decodeBm(f.status1, status1Mask)}
            ${this.decodeBm(f.status2, status2Mask)}
            <div>${f.time}</div>
            <div className="frame-details">
              <div>lat</div><div>${dataTypes.latitude.display(f.lat)}</div>
              <div>lon</div><div>${dataTypes.longitude.display(f.long)}</div>
              <div>log</div><div>${dataTypes.log.display(f.log)} Nm</div>
              <div>rpm</div><div>${dataTypes.engineSpeed.display(f.rpm)}</div>
              <div>coolant</div><div>${dataTypes.temperatureC.display(f.coolantTemp)} C</div>
              <div>exhaust</div><div>${dataTypes.temperatureC.display(f.exhaustT)} C</div>
              <div>oil pressure</div><div>${dataTypes.psi.display(f.oilPress)} psi</div>
              <div>alternator T</div><div>${dataTypes.temperatureC.display(f.alternatorT)} C</div>
              <div>alternator V</div><div>${dataTypes.voltage.display(f.altenatorV)} V</div>
            </div>
            <div className="frame-details">
              <div>enginBat   V</div><div>${dataTypes.voltage.display(f.engineBatteryV)} V</div>
              <div>serviceBat V</div><div>${dataTypes.voltage.display(f.serviceBatteryV)} V</div>
              <div>serviceBat A</div><div>${dataTypes.current.display(f.serviceBatteryA)} A</div>
              <div>serviceBat T</div><div>${dataTypes.temperatureC.display(f.serviceBatteryT)} C</div>
              <div>engineRoom T</div><div>${dataTypes.temperatureC.display(f.engineRoomT)} C</div>
              <div>senseT1</div><div>${dataTypes.temperatureC.display(f.senseT1)} C</div>
              <div>senseT2</div><div>${dataTypes.temperatureC.display(f.senseT2)} C</div>
              <div>senseT3</div><div>${dataTypes.temperatureC.display(f.senseT3)} C</div>
              <div>senseT4</div><div>${dataTypes.temperatureC.display(f.senseT4)} C</div>
            </div>
        </div>`);
      feedback.unshift(html`<div className="header">
            <div>Hours</div>
            <div>Status1</div>
            <div>Status2</div>
            <div>Time</div>
            <div>State</div>
        </div>`);
      return html`<div className="freeze-frames">${feedback}</div>`;
    }
    if (this.apiUrl === undefined) {
      return html`<div className="freeze-frames">Not connected</div>`;
    }
    return html`<${AdminCredentals} 
        credentialsOk=${this.authenticated} 
        checkLoginUrl='/api/login.json'
        apiUrl=${this.apiUrl} />`;
  }

  async authenticated() {
    this.setState({
      adminConnected: true,
    });
    await this.loadFreezeFrames();
  }

  async loadFrame(path) {
    const adminRequest = new AdminRequest(this.apiUrl);
    const ffRsponse = await adminRequest.fetch(path);
    return this.parseLog(await ffRsponse.text());
  }

  async loadFreezeFrames() {
    if (this.apiUrl === undefined) {
      return;
    }
    // list all files and filter to find the freeze frames,
    const adminRequest = new AdminRequest(this.apiUrl);
    const response = await adminRequest.fetch('/api/fs.json');
    const dir = await response.json();
    const framePromises = [];
    dir.files.forEach(async (f) => {
      if (!f.path.startsWith('/')) {
        f.path = `/${f.path}`;
      }
      if (f.path.startsWith('/engine/freezeframe')) {
        framePromises.push(this.loadFrame(f.path));
      }
    });
    if (framePromises.length === 0) {
      return;
    }
    // flatten the results into 1 array and sort
    const freezeFrames = (await Promise.all(framePromises)).flat(Infinity);
    freezeFrames.sort((a, b) => a.logTime - b.logTime);
    this.setState({
      freezeFrames,
      adminConnected: true,
    });
  }


  async requestEngineEvents() {
    await this.commandHandler('fetch-engine-events');
  }

  updateDisplayState(changes) {
    if (changes.engineEvents) {
      this.setState({
        engineEvents: changes.engineEvents.state,
      });
    }
  }

  showFetchButton() {
    if (this.apiUrl === undefined) {
      return '';
    }
    return html`<button onClick=${this.loadFreezeFrames} title="Get Freeze Frame ">Fetch</button>`;
  }

  showRequestButton() {
    if (this.apiUrl === undefined) {
      return '';
    }
    return html`<button onClick=${this.requestEngineEvents} title="Request Engine Events ">Fetch</button>`;
  }


  render() {
    return html`
            <div className="engine-events-view" >
              <div>Engine Events 
                ${this.showRequestButton()}
              </div>
              ${this.showEngineEvents()}
              <div>
                Engine Freeze Frames 
                ${this.showFetchButton()}
              </div>
              ${this.showFreezeFrames()}
            </div> 
            `;
  }
}
export { EngineView };
