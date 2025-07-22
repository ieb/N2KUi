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
  { mask: 0x200, name: 'Low Alterenator V' },
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
      '2025-07-20T05:07:06Z,1752988026,51.954330,1.278777,3076.199784,14.98,512,0,2218,77.2,29.9,56.941919,51.6,12.73,13.64,13.61,74.90,23.7,25.7,,,,',
      '2025-07-20T05:07:12Z,1752988032,51.954170,1.278883,3076.199784,14.98,512,0,2222,80.6,30.0,56.376271,51.9,12.72,13.67,13.65,89.60,23.7,25.8,,,,',
      '2025-07-20T05:07:27Z,1752988047,51.953880,1.279302,3076.199784,14.99,512,0,2220,83.9,30.2,56.825888,53.2,12.79,13.31,13.65,89.10,23.7,26.1,,,,',
      '2025-07-20T05:08:16Z,1752988096,51.953172,1.280876,3076.299676,15.00,512,0,2230,87.2,30.8,56.709858,58.1,12.73,13.75,13.53,33.10,23.6,26.9,,,,',
      '2025-07-20T05:08:59Z,1752988139,51.952647,1.282369,3076.399568,15.02,512,0,2232,86.9,31.9,55.796119,62.7,12.75,12.99,13.62,85.70,23.6,27.5,,,,',
      '2025-07-20T05:10:22Z,1752988222,51.951977,1.285478,3076.500000,15.04,512,0,2309,85.0,33.5,55.230470,70.2,12.77,13.43,13.63,71.40,23.6,29.0,,,,',
      '2025-07-20T05:10:24Z,1752988224,51.951968,1.285553,3076.500000,15.04,512,0,2310,89.2,33.5,54.896883,70.4,12.73,13.71,13.64,81.10,23.5,29.0,,,,',
      '2025-07-20T05:10:40Z,1752988240,51.951893,1.286190,3076.599892,15.04,512,0,2308,87.9,33.8,53.925128,71.4,12.73,13.08,13.64,80.50,23.5,29.4,,,,',
      '2025-07-20T05:11:21Z,1752988281,51.951727,1.287892,3076.599892,15.05,512,0,2303,84.3,34.4,54.026655,74.4,12.72,13.68,13.64,78.50,23.5,30.1,,,,',
      '2025-07-20T05:11:32Z,1752988292,51.951705,1.288340,3076.599892,15.06,512,0,2302,84.8,34.6,52.880855,74.9,12.78,12.84,13.64,78.50,23.5,30.3,,,,',
      '2025-07-20T05:11:44Z,1752988304,51.951677,1.288847,3076.699784,15.06,512,0,2304,85.1,34.9,52.387726,75.7,12.79,13.39,13.64,78.50,23.5,30.5,,,,',
      '2025-07-20T05:11:56Z,1752988316,51.951640,1.289335,3076.699784,15.06,512,0,2299,88.0,35.0,54.258716,76.4,12.69,13.62,13.63,77.70,23.5,30.7,,,,',
      '2025-07-20T05:12:02Z,1752988322,51.951623,1.289580,3076.699784,15.07,512,0,2299,86.6,35.0,52.242688,76.8,12.74,12.96,13.63,77.70,23.5,30.8,,,,',
      '2025-07-20T05:12:26Z,1752988346,51.951560,1.290572,3076.699784,15.07,512,0,2299,88.4,35.3,52.692305,78.2,12.73,13.65,13.65,81.70,23.4,31.2,,,,',
      '2025-07-20T05:12:38Z,1752988358,51.951533,1.291067,3076.799676,15.08,512,0,2297,86.4,35.5,52.474748,78.9,12.75,13.53,13.65,81.30,23.4,31.4,,,,',
      '2025-07-20T05:14:28Z,1752988468,51.951348,1.295693,3077.000000,15.11,512,0,2291,84.6,36.6,51.575513,83.8,12.74,13.53,13.65,79.80,23.3,33.1,,,,',
      '2025-07-20T05:14:54Z,1752988494,51.951218,1.296797,3077.000000,15.11,512,0,2289,88.7,36.8,51.575513,84.9,12.76,12.71,13.65,79.20,23.3,33.5,,,,',
      '2025-07-20T05:15:19Z,1752988519,51.950966,1.297797,3077.099892,15.12,512,0,2286,89.5,36.9,50.966353,85.6,12.73,13.55,13.65,79.10,23.3,33.9,,,,',
      '2025-07-20T05:15:56Z,1752988556,51.950491,1.299192,3077.099892,15.13,3,8,2280,97.4,37.2,50.212156,87.1,13.33,13.02,13.65,78.20,23.2,34.3,,,,',
      '2025-07-20T05:16:06Z,1752988566,51.950364,1.299570,3077.099892,15.13,513,8,2285,88.0,37.2,49.559485,87.2,12.78,13.37,13.65,78.00,23.2,34.5,,,,',
      '2025-07-20T05:16:25Z,1752988585,51.950120,1.300289,3077.199784,15.14,513,8,2283,86.6,37.3,49.893072,87.8,12.79,12.95,13.65,77.50,23.2,34.8,,,,',
      '2025-07-20T05:16:33Z,1752988593,51.950023,1.300596,3077.199784,15.14,513,8,2278,88.9,37.4,49.951087,87.9,12.76,13.35,13.65,77.90,23.2,34.9,,,,',
      '2025-07-20T05:17:19Z,1752988639,51.949280,1.302012,3077.299676,15.15,513,8,2280,85.1,37.6,49.037348,89.3,12.77,13.52,13.65,77.30,23.1,35.5,,,,',
      '2025-07-20T05:17:25Z,1752988645,51.949170,1.302173,3077.299676,15.15,513,8,2282,85.6,37.6,50.125133,89.4,12.74,13.50,13.65,77.30,23.1,35.6,,,,',
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
    const statusBmN = +statusBm;
    bitMasks.forEach((v) => {
      // eslint-disable-next-line no-bitwise
      if ((statusBmN & v.mask) === v.mask) {
        status.push(html`<div>${v.name}</div>`);
      }
    });
    return html`<div className="status">${status}</div>`;
  }

  showFreezeFrames() {
    if (this.state.adminConnected ) {
      const { dataTypes } = DataTypes;
      const feedback = this.state.freezeFrames.map((f) => html`<div className="frame">
            <div>${dataTypes.engineHours.display(f.engineHours)}</div>
            ${this.decodeBm(f.status1, status1Mask)}
            ${this.decodeBm(f.status2, status2Mask)}
            <div>${f.time}</div>
            <div className="frame-details">
              <div>lat</div><div>${dataTypes.latitude.display(f.lat)}</div>
              <div>lon</div><div>${dataTypes.longitude.display(f.long)}</div>
              <div>log</div><div>${dataTypes.logNm.display(f.log)} Nm</div>
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
