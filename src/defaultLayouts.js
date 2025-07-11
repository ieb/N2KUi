
const layouts = {
  engine: {
    pageId: 1,
    pages: [{
      boxes: [
        { field: 'dbt', id: 1 },
        { field: 'cogm', id: 2 },
        { field: 'hdm', id: 3 },
        { field: 'sog', id: 4 },
        { field: 'engineSpeed_0', id: 5 },
        { field: 'engineCoolantTemperature_0', id: 6 },
        { field: 'engineRoomTemperature_0', id: 7 },
        { field: 'exhaustTemperature', id: 8 },
        { field: 'alternatorTemperature', id: 9 },
        { field: 'alternatorTemperature_0', id: 10 },
        { field: 'alternatorVoltage_0', id: 11 },
        { field: 'engineCoolantTemperature_0', id: 12 },
        { field: 'fuelLevel_0', id: 13 },
        { field: 'Log', id: 14 },
        { field: 'Position', id: 15 },
        { field: 'atmosphericPressure_0', id: 16 },
        { field: 'Engine Events', id: 16 },
      ],
      id: 1,
      name: 'Engine',
    }],
  },
  sailing: {
    pageId: 1,
    pages: [{
      boxes: [
        { field: 'stw', id: 1713688208539 },
        { field: 'awa', id: 1714720124318 },
        { field: 'aws', id: 1714720128961 },
        { field: 'Position', id: 1713688180180 },
        { field: 'sog', id: 1714720345973 },
        { field: 'twa', id: 1714720350780 },
        { field: 'tws', id: 1714720353242 },
        { field: 'polarSpeed', id: 1714720385573 },
        { field: 'targetTwa', id: 1714720417941 },
        { field: 'vmg', id: 1714720476494 },
        { field: 'polarVmg', id: 1714720494522 },
        { field: 'polarSpeedRatio', id: 1714720485837 },
        { field: 'rudderPosition', id: 1714720524662 },
        { field: 'seaTemperature', id: 1714720552606 },
        { field: 'atmosphericPressure_0', id: 1714720566404 },
      ],
      id: 1,
      name: 'Sailing',
    }],
  },
};


class DefaultLayouts {
  static get defaultLayout() {
    return 'sailing';
  }

  static load() {
    Object.keys(layouts).forEach((name) => {
      if (localStorage.getItem(`layout-${name}`) === null) {
        localStorage.setItem(`layout-${name}`, JSON.stringify(layouts[name]));
        console.log('loaded layout', name);
      }
    });
  }
}


export { DefaultLayouts };
