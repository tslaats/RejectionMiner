
$(document).ready(function(e) {
    document.MiningGUI = new GUI_Mining(document.getElementById("mining"));
    document.MiningGUI.renderOnce();
    document.MiningGUI.render();
});



class GUI_Mining
{
    logFile;
    miner;
    panel;
    mainPanel;
    fr;
    dcrInput;
    editorFeedback;
    currentDCR;
    activitiesBox;
    dcrName;
    checker;

    newLog;
    logcount;

    
    constructor(panel) 
    {
        this.mainPanel = panel;
        this.fr = new FileReader();

    }


    renderOnce()
    {
        var result = ``
        result +=  `Please select a XES logfile, or a zip file containing multiple logs: `
        result +=  `<input type="file" id="log" name="log" onChange="document.MiningGUI.loadLogFile()" />`;                
        result +=  `<div id="mining-details"></div>`                
        this.mainPanel.innerHTML = result;
        this.panel = document.getElementById("mining-details");        
    }


    render ()
    {
        var result = ``

        if (this.miner === undefined)
            result += `No log loaded.`;
        else if (this.miner !== undefined)
            result += this.miner.render();

        this.panel.innerHTML = result;
    }   

    logLoaded() {                        
        console.timeEnd('Loading...')
        this.logFile = new XESFile(this.fr.result);        
        if (this.logFile.logs.length == 1)
        {        
            this.miner = new Miner(this.logFile.logs[0]);
        }
        console.time('Mining...')
        this.miner.mine();
        console.timeEnd('Mining...')
        this.render();        
    }  


    loadZip(f)
    {      
        console.time('Loading...')
        JSZip.loadAsync(f)                                  
        .then(function(zip) {           


            var entries = Object.keys(zip.files).map(function (name) {
                return zip.files[name];
            });
            
            var listOfPromises = entries.map(function(entry) {
                return entry.async("text").then(function (u8) {
                return [entry.name, u8];
                });
            });
            
            var promiseOfList = Promise.all(listOfPromises);
            
            promiseOfList.then(function (list) {
                this.miner = new MultiMiner();            
                list.forEach(item => {       
                    console.log(item[1]);             
                    var l = new XESFile(item[1]);        
                    this.miner.addLog(l);
                });
                
                console.timeEnd('Loading...')                
                
                this.panel.innerHTML = "Mining..."
                console.time('Mining...')
                this.miner.mine();
                console.timeEnd('Mining...')
                this.render();   
                
            }.bind(this));
        }.bind(this));

    }    


    loadSingleLog(file)
    {
        this.fr.onload = this.logLoaded.bind(this);
        console.time('Loading...')
        this.fr.readAsText(file);               
    }

    loadLogFile() {
        this.panel.innerHTML = "Loading & mining... (May take a while, please be patient and keep your window active!)"
        var x = document.getElementById("log");
        if (x.files.size == 0)
            return;

        var file = x.files[0];        

        if(this.getExtension(file.name) == "zip")
            this.loadZip(file);
        else
            this.loadSingleLog(file);        
    }

  
    getExtension(filename) {
        var parts = filename.split('.');
        return parts[parts.length - 1].toLowerCase();
    }

}
