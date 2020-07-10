
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
        var result = `<input type="file" id="log" name="log" onChange="document.MiningGUI.loadLogFile()" />`;                
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
            this.miner = new KFoldMiner(this.logFile.logs[0]);
        }

        this.panel.innerHTML = "Mining..."
        console.time('Mining...')
        this.miner.mine();
        console.timeEnd('Mining...')
        this.render();        
    }  


    loadSingleLog(file)
    {
        this.fr.onload = this.logLoaded.bind(this);
        console.time('Loading...')
        this.fr.readAsText(file);               
    }

    loadLogFile() {
        this.panel.innerHTML = "Loading..."
        var x = document.getElementById("log");
        if (x.files.size == 0)
            return;

        var file = x.files[0];        

        this.loadSingleLog(file);        
    }

  
    getExtension(filename) {
        var parts = filename.split('.');
        return parts[parts.length - 1].toLowerCase();
    }

}
