import { h, render, Component } from './deps/preact/preact.module.js';
import htm from './deps/htm/index.module.js';
const html = htm.bind(h);


class AdminView  extends Component {
    constructor(props) {
        super(props);
        this.props = props;
        this.apiUrl = `http://${props.host}`;
        this.state = {
            pauseButton: "Pause",
            fileSystem: {}
        };
        this.uploadReference = undefined;
        this.uploadPathReference = undefined;
        this.setUploadRef = this.setUploadRef.bind(this);
        this.setPathRef = this.setPathRef.bind(this);
        this.onFileChange = this.onFileChange.bind(this);
        this.deleteFile = this.deleteFile.bind(this);
        this.clickUpload = this.clickUpload.bind(this);

    }


    async componentDidMount() {
        await this.updateFileSystem();
    }
    
    componentWillUnmount() {
    }

    async updateFileSystem() {
        const response = await fetch(`${this.apiUrl}/api/fs.json`, {
            credentials: "include"
        });
        console.log("Response ", response);
        const dir = await response.json();
        console.log("Got Files", dir);
        this.setState({
            dir
        });
    }
    async deleteFile(path) {
        console.log("Delete ", path);
        const details = {
            'op': 'delete',
            'path': path,
        };

        const formBody = [];
        for (var property in details) {
          var encodedKey = encodeURIComponent(property);
          var encodedValue = encodeURIComponent(details[property]);
          formBody.push(encodedKey + "=" + encodedValue);
        }
        const body = formBody.join("&");
        const response = await fetch(`${this.apiUrl}/api/fs.json`, {
            method: "POST",
            mode: "cors", 
            credentials: "include",
            body
        });
        const result = await response.json();
        console.log("Delete result ", result);
        await this.updateFileSystem();
    }

    setUploadRef(ref) {
        this.uploadReference = ref;
    }
    setPathRef(ref) {
        this.uploadPathReference = ref;
    }
    onFileChange() {
        if ( this.uploadReference ) {
            if ( this.uploadPathReference ) {
                let path = this.uploadReference.files[0].name;
                if ( !path.startsWith("/") ) {
                    path = "/"+path;
                }
                this.uploadPathReference.value = path;
            }
        }
    }
    async clickUpload() {
        console.log("Upload ");
        if ( this.uploadReference && this.uploadReference.files[0]) {
            let path = "/"+this.uploadReference.files[0].name;
            if ( this.uploadPathReference && this.uploadPathReference.value ) {
                path = this.uploadPathReference.value;
            }
            console.log("Uploading ", path, this.uploadReference.files);
            const formData = new FormData();
            formData.append("op", "upload");
            formData.append("path", path);
            formData.append("file", this.uploadReference.files[0]);
            const response = await fetch(`${this.apiUrl}/api/fs.json`, {
                method: "POST",
                mode: "cors", 
                credentials: "include",
                body: formData
            });
            const result = await response.json();
            console.log("Upload result ", result);
            await this.updateFileSystem();
        } else {
            console.log("No file selected",this.uploadReferece.current);
        }
    }

    renderFile(n, fileInfo) {
        const clickDelete = () => {
            this.deleteFile(fileInfo.path);
        };
        const clickUpdate = () => {
            this.updateFile(fileInfo.path);
        };
        const downloadUrl = `${this.apiUrl}${fileInfo.path}`;
        return html`<div className="line" key=${n}>
                      <div className="fileInfo">
                        <div><a href="${downloadUrl}" >${fileInfo.path}</a></div>
                        <div>${fileInfo.size}</div>
                        <div>
                            <button onClick=${clickDelete} title="delete ${fileInfo.path} ">-</button>
                        </div>
                      </div>
                    </div>`;
    }

    renderFileList() {
        const fileList = [];
        if ( this.state.dir ) {
            const files = this.state.dir.files;
            for (let x = 0;x < files.length; x++ ) {
                fileList.push(this.renderFile(x,files[x]));
            }            
        }
        return fileList;
    }


    formatBytes(b) {
        if ( b > 1*1024*1024 ) {
            return (b/(1024*1024)).toFixed(2)+"MB";
        } else if (b > 1.2*1024 ) {
            return  (b/(1024)).toFixed(1)+"KB";
        } else {
            return  (b.toFixed(0))+"B";
        }
    }

    render() {
        let totalSize=0, usedSize=0, freeSize=0;
        if ( this.state.dir ) {
            totalSize = this.formatBytes(this.state.dir.disk.size);
            usedSize = this.formatBytes(this.state.dir.disk.used);
            freeSize = this.formatBytes(this.state.dir.disk.free);
        }
        return html`
            <div className="adminview" >
            <div>Filesystem Total:${totalSize} Used:${usedSize} Free:${freeSize}
            <input ref=${this.setUploadRef} type="file" onInput=${this.onFileChange} /> 
            as
            <input ref=${this.setPathRef} type="text" />
            <button onClick=${this.clickUpload} title="Upload new file ">Upload</button></div>
            <div className="logviewer">${this.renderFileList()}</div>
            </div> `;
    }
}


export { AdminView };