
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

    
    constructor(panel) 
    {
        this.mainPanel = panel;
        this.fr = new FileReader();

    }


    renderOnce()
    {
        var result = `<input type="file" id="log" name="log" onChange="document.MiningGUI.loadLog()" />`;        
        result += ` <textarea id="newLog" rows="20" cols="150"></textarea>`
        result +=  `<div id="mining-details"></div>`        
        this.mainPanel.innerHTML = result;
        this.panel = document.getElementById("mining-details");
        this.newLog = document.getElementById("newLog");
    }


    render ()
    {

    }   

    logLoaded() {                        
        console.timeEnd('Loading...')
        var d = new Dreyers();

        this.newLog.innerHTML = d.CSVtoXES(this.fr.result)
    }  

    loadLog() {
        this.panel.innerHTML = "Loading..."
        var x = document.getElementById("log");
        if (x.files.size == 0)
            return;

        var file = x.files[0];        
        this.fr.onload = this.logLoaded.bind(this);
        console.time('Loading...')
        this.fr.readAsText(file);           
    }

  

}
