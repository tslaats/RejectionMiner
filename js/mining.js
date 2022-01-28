class ConsistenceCheck
{
    logFile;
    inconsistentLogs = new Set();
    doubleTraceLogs = new Set();

    constructor(logFile)
    {
        this.logFile = logFile;        
    }

    mine()
    {
        for(var l of this.logFile.logs)
        {        
            this.check(l);
        }        
    }

    check(log)
    {
        var activityIDToName = new Map();
        var activityNameToID = new Map();    
        var pos = new Set();
        var neg = new Set();
        
        var i = 0;
        for (var a of log.activities)
        {
            activityIDToName.set(i, a);
            activityNameToID.set(a, i);
            i++;
        }

        for (var t of log.traces)            
        {   
            var x = "";
            for (var e of t.events)            
            {
                var n = e.conceptName;                
                var id = activityNameToID.get(n);
                x += id + "-";                
            }
            if (t.isNegative())
            {
                if (neg.has(x))                    
                    this.doubleTraceLogs.add(log.conceptName);
                if (pos.has(x))
                {                    
                    this.inconsistentLogs.add(log.conceptName);                    
                    console.log("neg" + log.conceptName + ":" + x);
                    t.isConsistent = false;
                }
                neg.add(x);                                    
            }
            if (t.isPositive())
            {
                if (pos.has(x))                    
                    this.doubleTraceLogs.add(log.conceptName);
                if (neg.has(x))                    
                {
                    this.inconsistentLogs.add(log.conceptName);                    
                    console.log("pos" + log.conceptName + ":" + x);
                    t.isConsistent = false;
                }
                pos.add(x);                                    
            }                                    
        }
    }


    render()
    {
        var result = `<table class="resultTable">
        <tr>
          <th>Inconsistent Log ID</th>          
        </tr>`;        
        for(var l of this.inconsistentLogs)
        {
            result += `  <tr>
            <td>${l}</td>`            
            result += `</tr>`;
    
        }
        result += `</table>`;

        result += `<table class="resultTable">
        <tr>
          <th>Double Trace Log ID</th>          
        </tr>`;        
        for(var l of this.doubleTraceLogs)
        {
            result += `  <tr>
            <td>${l}</td>`            
            result += `</tr>`;
    
        }
        result += `</table>`;

        return result;
    }    

}

class KFoldMiner
{
    log;
    trainingMiners = [];    
    testMiners = [];
    results = [];
    constructor(log)
    {        
        this.log = log;
    }

    mine(n = 10, m = 10)
    {

        this.results = [];

        // loop over all attempts
        for (var j = 0; j < m; j++) 
        {        
            var localResult = [];

            this.log.foldTraces(n);
            

            // loop over all folds 
            for (var i = 0; i < n; i++) 
            {        
                console.log("Fold : " + i);                
                var miner = new Miner(this.log);                

                var t0 = performance.now()
                miner.mine(this.log.trainingSet(i));
                var t1 = performance.now()                

                var testMiner = new Miner(this.log);                
                testMiner.mine(this.log.testSet(i));

                
                var model = miner.greedyModel;

                
                // positives...
                var posFails = new Set();
                for (var c of model)
                {
                    for (var c2 of testMiner.results())
                    {
                        if (c.type == c2.type && c.a == c2.a && c.b == c2.b)
                            for (var t of c2.contradictions)
                                posFails.add(t);
                    }
                }


                // negatives...
                var negFails = this.filterNegative(this.log.testSet(i));            
                for (var c of model)
                {                
                    for (var c2 of testMiner.results())
                    {
                        if (c.type == c2.type && c.a == c2.a && c.b == c2.b)
                            for (var t of c2.support)
                                negFails.delete(t);
                    }
                }            
                



                localResult.push({
                            foldId: i, 
                            posTraining: this.countPositive(this.log.trainingSet(i)),
                            negTraining: this.countNegative(this.log.trainingSet(i)),
                            posTest: this.countPositive(this.log.testSet(i)),
                            negTest: this.countNegative(this.log.testSet(i)),
                            posFails: posFails.size,
                            negFails: negFails.size,
                            size: model.size,
                            time: (t1 - t0)
                        });                
            }   
            this.results.push(localResult);     
        }        
    }    

    countPositive(traces)
    {
        var i = 0;        
        for (var t of traces)                    
            if(t.isPositive())
                i++;
        return i;
    }

    countNegative(traces)
    {
        var i = 0;        
        for (var t of traces)                    
            if(t.isNegative())
                i++;
        return i;
    }   
    
    filterNegative(traces)
    {
        var result = new Set();          
        for (var t of traces)                    
            if(t.isNegative())
                result.add(t.conceptName);
        return result;
    }   
    
        

    verify(miner, traces)
    {
        
    }


    render()
    {       

        var tPPV = 0;        
        var tTPR = 0;        
        var tF1 = 0;        
        var tTNR = 0;        
        var tACC = 0;        
        var tSize = 0;    
        var tTime = 0;   

        var tCount = 0;

        var result = `<table class="resultTable">
        <tr>
          <th>Fold ID</th>
          <th>Condition Positive (Training)</th>
          <th>Condition Negative (Training)</th>
          <th>Condition Positive (Test)</th>
          <th>Condition Negative (Test)</th>
          <th>False Negatives</th>
          <th>False Positives</th>
          <th>Recall</th>
          <th>Specificity</th>
          <th>Accuracy</th>
          <th>PPV</th>
          <th>F1</th>
          <th>Size</th>          
          <th>Time</th>          
        </tr>`;        

        for(var rs of this.results)
        {
            var totalPosTest= 0;
            var totalNegTest = 0;
            var totalPosFails = 0;
            var totalNegFails = 0;        
            var totalSupport = 0;
            var logCount = 0;
            var totalActivities = 0;
            var totalEvents = 0;
            var totalConstraints = 0;
            var totalCost = 0;
            
            
            var cCount = 0;
            var cPPV = 0;        
            var cTPR = 0;        
            var cF1 = 0;        
            var cTNR = 0;        
            var cACC = 0;        
            var cSize = 0;    
            var cTime = 0;    

            for(var r of rs)
            {
                var TP = r.posTest - r.posFails;        
                var FN = r.posFails;        
                var FP = r.negFails;        
                var TN = r.negTest - r.negFails;
                var PPV = (TP / (TP + FP));
                var TPR = (TP / (TP + FN));
                var F1 = 2 * ((PPV * TPR) / (PPV + TPR));
                var TNR = (TN / (TN + FP));
                var ACC = ((TP + TN) / (TP + FP + FN + TN));
                var Size = r.size;
                var Time = r.time;


                cPPV += PPV;
                cTPR += TPR;
                cF1 += F1;
                cTNR += TNR;
                cACC += ACC;
                cSize += Size;
                cTime += Time;
        

                result += `  <tr>
                <td>${r.foldId}</td>
                <td>${r.posTraining}</td>
                <td>${r.negTraining}</td>
                <td>${r.posTest}</td>
                <td>${r.negTest}</td>
                <td>${r.posFails}</td>
                <td>${r.negFails}</td>
                <td>${TPR}</td>
                <td>${TNR}</td>
                <td>${ACC}</td>
                <td>${PPV}</td>
                <td>${F1}</td>
                <td>${Size}</td>
                <td>${Time}</td>
                `                        
                result += `</tr>`;

                totalPosTest += r.posTest;
                totalNegTest += r.negTest;            

                totalPosFails += r.posFails;
                totalNegFails += r.negFails;     
                
                logCount++;
                cCount++;
                tCount++;


            }
    

            result += `  <tr>
            <td>Total (${logCount})</td>
            <td>${totalPosTest}</td>
            <td>${totalNegTest}</td>        
            <td>${totalPosTest}</td>
            <td>${totalNegTest}</td>
            <td>${totalPosFails}</td>
            <td>${totalNegFails}</td>
            <td>${cTPR / cCount}</td>
            <td>${cTNR / cCount}</td>
            <td>${cACC / cCount}</td>
            <td>${cPPV / cCount}</td>
            <td>${cF1 / cCount}</td>
            <td>${cSize / cCount}</td>          
            <td>${cTime / cCount}</td> 
            ` 

            result += `</tr>`;
            result += `<tr></tr>`;
            
            tPPV += cPPV;        
            tTPR += cTPR;        
            tF1 += cF1;        
            tTNR += cTNR;        
            tACC += cACC;        
            tSize += cSize;        
            tTime += cTime;       
        }    


        result += `  <tr>
        <td>Final total (${tCount})</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>${tTPR / tCount}</td>
        <td>${tTNR / tCount}</td>
        <td>${tACC / tCount}</td>
        <td>${tPPV / tCount}</td>
        <td>${tF1 / tCount}</td>
        <td>${tSize / tCount}</td>          
        <td>${tTime / tCount}</td>         
        `         

        result += `</table>`;

        return result;        
    }


}

class MultiMiner

{
    files = [];
    miners = [];

    constructor()
    {
        
    }

    addLog(l)
    {
        this.files.push(l);
    }

    mine()
    {
        for(var f of this.files)
        {        
            var miner = new Miner(f.logs[0]);
            this.miners.push(miner);
            miner.mine();
        }        
    }

    render()
    {
        var totalNegativeTraceCount = 0;
        var totalPositiveTraceCount = 0;
        var totalSupport = 0;
        var logCount = 0;
        var totalActivities = 0;
        var totalEvents = 0;
        var totalConstraints = 0;
        var totalCost = 0;

        var result = `<table class="resultTable">
        <tr>
          <th>Log ID</th>
          <th>Activities</th>
          <th>Events</th>
          <th>Negative traces</th>          
          <th>Positive traces</th>          
          <th>Rejected negative traces</th>
          <th>TPR (Recall)</th>              
          <th>TNR (Specificity)</th>              
          <th>Accuracy</th>              
          <th>Constraints in greedy model</th>                    
        </tr>`;        

        this.miners.sort(function(b, a){return a.log.negativeTraceCount - b.log.negativeTraceCount});
        this.miners.sort(function(a, b){return (a.supports.length / a.log.negativeTraceCount) - (b.supports.length / b.log.negativeTraceCount)});
        for(var m of this.miners)
        {
            result += `  <tr>
            <td>${m.log.conceptName}</td>
            <td>${m.countActivities}</td>
            <td>${m.countEvents}</td>
            <td>${m.log.negativeTraceCount}</td>
            <td>${m.log.positiveTraceCount}</td>
            <td>${m.supports.length}</td>
            <td>1</td>
            <td>${(m.log.negativeTraceCount !== 0) ? (m.supports.length / m.log.negativeTraceCount) : 1}</td>            
            <td>${(m.log.negativeTraceCount !== 0) ? ((m.supports.length + m.log.positiveTraceCount) / (m.log.negativeTraceCount + m.log.positiveTraceCount)): 1}</td>            
            <td>${m.greedyModel.size}</td>                        
            `                        
            result += `</tr>`;

            totalNegativeTraceCount += m.log.negativeTraceCount;
            totalPositiveTraceCount += m.log.positiveTraceCount;
            totalSupport += m.supports.length;    
            totalActivities += m.countActivities;
            totalEvents += m.countEvents;
            totalConstraints += m.greedyModel.size;
            totalCost += m.costOf(m.greedyModel);
            logCount++;
        }
        result += `  <tr>
        <td>Total (${logCount})</td>
        <td>${totalActivities}</td>
        <td>${totalEvents}</td>        
        <td>${totalNegativeTraceCount}</td>
        <td>${totalPositiveTraceCount}</td>
        <td>${totalSupport}</td>
        <td>1</td>
        <td>${(totalNegativeTraceCount !== 0) ? (totalSupport / totalNegativeTraceCount) : 1}</td>            
        <td>${(totalNegativeTraceCount !== 0) ? ((totalSupport + totalPositiveTraceCount) / (totalNegativeTraceCount +totalPositiveTraceCount)) : 1}</td>            
        <td>${totalConstraints}</td>                    
        `
        result += `</tr>`;
        result += `</table>`;
        return result;
    }

}



class Miner
{
    log;
    activityIDToName = new Map();
    activityNameToID = new Map();
    conditionSupport = [];
    conditionContradictions = [];
    responseSupport = [];
    responseContradictions = [];
    initialResponseSupport = [];
    initialResponseContradictions = [];
    initialExcludeSupport = [];
    initialExcludeContradictions = [];    
    selfExcludeSupport = [];
    selfExcludeContradictions = [];   
    excludeSupport = [];
    excludeContradictions = [];   
    
    max2Support = [];
    max2Contradictions = [];

    alternatePrecedenceSupport = [];
    alternatePrecedenceContradictions = [];

    disResponseSupport = [];
    disResponseContradictions = [];    


    conResponseSupport = [];
    conResponseContradictions = [];        

    countActivities = 0;
    countEvents = 0;

    constructor(log) 
    {
        this.log = log;
    }


    mine(traces = this.log.traces)
    {

        var i = 0;
        for (var a of this.log.activities)
        {
            this.activityIDToName.set(i, a);
            this.activityNameToID.set(a, i);
            i++;
        }
        this.countActivities = i;

        for (var i of this.activityIDToName.keys())
        {
            this.initialResponseSupport[i] = [];
            this.initialResponseContradictions[i] = [];
            this.initialExcludeSupport[i] = [];
            this.initialExcludeContradictions[i] = [];
            this.selfExcludeSupport[i] = [];
            this.selfExcludeContradictions[i] = [];            
            this.conditionSupport[i] = [];
            this.conditionContradictions[i] = [];            
            this.responseSupport[i] = [];
            this.responseContradictions[i] = [];                  
            this.excludeSupport[i] = [];
            this.excludeContradictions[i] = [];                   
            
            this.disResponseSupport[i] = [];
            this.disResponseContradictions[i] = [];                              

            this.conResponseSupport[i] = [];
            this.conResponseContradictions[i] = [];    
            
            this.max2Support[i] = [];
            this.max2Contradictions[i] = [];            

            this.alternatePrecedenceSupport[i] = [];
            this.alternatePrecedenceContradictions[i] = [];             

            for (var j of this.activityIDToName.keys())
            {            
                this.conditionSupport[i][j] = [];
                this.conditionContradictions[i][j] = [];                
                this.responseSupport[i][j] = [];
                this.responseContradictions[i][j] = [];                                
                this.excludeSupport[i][j] = [];
                this.excludeContradictions[i][j] = [];                                              

                this.disResponseSupport[i][j] = [];
                this.disResponseContradictions[i][j] = [];                                                

                this.conResponseSupport[i][j] = [];
                this.conResponseContradictions[i][j] = [];       
                
                this.alternatePrecedenceSupport[i][j] = [];
                this.alternatePrecedenceContradictions[i][j] = [];                             

                for (var k of this.activityIDToName.keys())
                {                            
                    this.disResponseSupport[i][j][k] = [];
                    this.disResponseContradictions[i][j][k] = [];                                                

                    this.conResponseSupport[i][j][k] = [];
                    this.conResponseContradictions[i][j][k] = [];                                                                    
    
                }
            }
        }


        for (var t of traces)            
        {
            var contains = [];
            var before = []; // before first
            var after = [];  // after last  
            var afterFirst = []; // after first
            var count = [];
            var toggle = [];
            var altPre = [];

            for (var i of this.activityIDToName.keys())
            {
                contains[i] = false;
                before[i] = [];    
                after[i] = [];    
                count[i] = 0;
                afterFirst[i] = [];
                toggle[i] = [];
                altPre[i] = [];

                for (var j of this.activityIDToName.keys())
                {
                    toggle[i][j] = false;
                    altPre[i][j] = true;
                }    
            }

            for (var e of t.events)            
            {
                this.countEvents++;
                var n = e.conceptName;                
                var id = this.activityNameToID.get(n);
                contains[id] = true;
                count[id]++;
                for (var i of this.activityIDToName.keys())
                {
                    if(!toggle[i][id])
                        altPre[i][id] = false;
                    else
                        toggle[i][id] = false;                    
                    toggle[id][i] = true;
                    
                    if (!contains[i])
                        if(!before[i].includes(id))
                            before[i].push(id);

                    if (contains[i])                            
                        if(!after[i].includes(id))
                            after[i].push(id);

                    if (contains[i])                            
                        if(!afterFirst[i].includes(id))
                            afterFirst[i].push(id);                                                        
                }           
                after[id] = [];     
            }

            var out = [];
            var seen = [];
            for (var j of this.activityIDToName.keys())
            {                
                if (!contains[j])                       
                    out.push(j);
                else                    
                    seen.push(j);
                    
            }                
            
            /*
            if (t.conceptName == "14b-304_P")
            {
                console.log(JSON.stringify(seen));            
                console.log(JSON.stringify(out));                            
            }*/

            for (var x1 of seen)
            {           
                for (var x2 of out)
                {
                    if (t.isNegative()) 
                    {
                        if(!this.conditionSupport[x2][x1].includes(t.conceptName))
                            this.conditionSupport[x2][x1].push(t.conceptName);                                                    
                        if(!this.responseSupport[x1][x2].includes(t.conceptName))
                            this.responseSupport[x1][x2].push(t.conceptName);                            
                    }
                    else if (t.isPositive()) 
                    {
                        if(!this.conditionContradictions[x2][x1].includes(t.conceptName))
                            this.conditionContradictions[x2][x1].push(t.conceptName);                                                                            
                        if(!this.responseContradictions[x1][x2].includes(t.conceptName))
                            this.responseContradictions[x1][x2].push(t.conceptName);
                    }

                    for (var x3 of out)
                    {
                        if (t.isNegative()) 
                        {
                            if(!this.disResponseSupport[x1][x2][x3].includes(t.conceptName))
                                this.disResponseSupport[x1][x2][x3].push(t.conceptName);                            
                        }
                        else if (t.isPositive()) 
                        {
                            if(!this.disResponseContradictions[x1][x2][x3].includes(t.conceptName))
                                this.disResponseContradictions[x1][x2][x3].push(t.conceptName);
                        }    
                    }                    
                }
            }

            for (var x1 of seen)
            {
                for (var x2 of afterFirst[x1])
                {
                    if (t.isNegative()) 
                        this.excludeSupport[x1][x2].push(t.conceptName);                                                    
                    else if (t.isPositive())                     
                        this.excludeContradictions[x1][x2].push(t.conceptName);                                                    
                }
            }


            for (var i of this.activityIDToName.keys())
            {               
                if (count[i] > 1)
                {
                    if (t.isNegative()) 
                        this.selfExcludeSupport[i].push(t.conceptName);
                    else if (t.isPositive()) 
                        this.selfExcludeContradictions[i].push(t.conceptName);

                }

                if (count[i] > 2)
                {
                    if (t.isNegative()) 
                        this.max2Support[i].push(t.conceptName);
                    else if (t.isPositive()) 
                        this.max2Contradictions[i].push(t.conceptName);
                }

                if (!contains[i]) 
                {
                    if (t.isNegative()) 
                        this.initialResponseSupport[i].push(t.conceptName);
                    else if (t.isPositive()) 
                        this.initialResponseContradictions[i].push(t.conceptName);
                }
                else if (contains[i])
                {
                    if (t.isNegative()) 
                    {
                        this.initialExcludeSupport[i].push(t.conceptName);
                        for (var j of before[i])
                            if (!this.conditionSupport[i][j].includes(t.conceptName))
                                this.conditionSupport[i][j].push(t.conceptName);
                    }
                    else if (t.isPositive()) 
                    {
                        this.initialExcludeContradictions[i].push(t.conceptName);
                        for (var j of before[i])
                            if (!this.conditionContradictions[i][j].includes(t.conceptName))
                                this.conditionContradictions[i][j].push(t.conceptName);                        
                    }
                }
                                
                for (var j of after[i])
                {
                    if (t.isNegative()) 
                    {
                        if(!this.responseSupport[j][i].includes(t.conceptName))
                            this.responseSupport[j][i].push(t.conceptName);                            
                    }
                    else if (t.isPositive()) 
                    {
                        if(!this.responseContradictions[j][i].includes(t.conceptName))
                            this.responseContradictions[j][i].push(t.conceptName);
                    }
                }

            } 

            for (var x1 of seen)
            {
                for (var x2 of this.activityIDToName.keys())
                {
                    for (var x3 of this.activityIDToName.keys())
                    {
                        if (t.isNegative()) 
                        {
                            if (!after[x1].includes(x2) && !after[x1].includes(x3))
                                if(!this.disResponseSupport[x1][x2][x3].includes(t.conceptName))
                                    this.disResponseSupport[x1][x2][x3].push(t.conceptName);                            
                        }
                        else if (t.isPositive()) 
                        {
                            if (!after[x1].includes(x2) && !after[x1].includes(x3))                                
                                if(!this.disResponseContradictions[x1][x2][x3].includes(t.conceptName))
                                    this.disResponseContradictions[x1][x2][x3].push(t.conceptName);
                        }            
                    }
                }
            }                   


            // alternate precedence
            
            for (var x1 of this.activityIDToName.keys())
            {
                for (var x2 of seen)
                {
                    if (t.isNegative()) 
                    {
                        if (!altPre[x1][x2])                            
                            this.alternatePrecedenceSupport[x1][x2].push(t.conceptName);                            
                    }
                    else if (t.isPositive()) 
                    {
                        if (!altPre[x1][x2])                            
                            this.alternatePrecedenceContradictions[x1][x2].push(t.conceptName);
                    }            
                }
            }               

            // conjunctive response
            for (var x1 of seen)
            {
                for (var x2 of seen)
                {
                    for (var x3 of this.activityIDToName.keys())
                    {                    
                        if (t.isNegative()) 
                        {
                            if (!after[x1].includes(x3) && !after[x2].includes(x3))
                                if(!this.conResponseSupport[x1][x2][x3].includes(t.conceptName))
                                    this.conResponseSupport[x1][x2][x3].push(t.conceptName);                            
                        }
                        else if (t.isPositive()) 
                        {
                            if (!after[x1].includes(x3) && !after[x2].includes(x3))
                                if(!this.conResponseContradictions[x1][x2][x3].includes(t.conceptName))
                                    this.conResponseContradictions[x1][x2][x3].push(t.conceptName);
                        }             
                    }
                }
            }            


        }       
    }

    resultsCache;

    results()
    {
        if (this.resultsCache !== undefined)
            return this.resultsCache;

        var result = [];
        for (var i of this.activityIDToName.keys())
        {                
            result.push({cost: 1, type: "initRes", a: this.name(i), support: this.initialResponseSupport[i], contradictions: this.initialResponseContradictions[i]});
            result.push({cost: 1, type: "initEx", a: this.name(i), support: this.initialExcludeSupport[i], contradictions: this.initialExcludeContradictions[i]});            
            result.push({cost: 1, type: "selfEx", a: this.name(i), support: this.selfExcludeSupport[i], contradictions: this.selfExcludeContradictions[i]});            

            result.push({cost: 3, type: "max2", a: this.name(i), support: this.max2Support[i], contradictions: this.max2Contradictions[i]});            

            for (var j of this.activityIDToName.keys())
            {
                if (i != j) result.push({cost: 1, type: "condition", a: this.name(i), b: this.name(j), support: this.conditionSupport[i][j], contradictions: this.conditionContradictions[i][j]});            
                if (i != j) result.push({cost: 1, type: "response", a: this.name(i), b: this.name(j), support: this.responseSupport[i][j], contradictions: this.responseContradictions[i][j]});            
                if (i != j) result.push({cost: 1, type: "exclude", a: this.name(i), b: this.name(j), support: this.excludeSupport[i][j], contradictions: this.excludeContradictions[i][j]});                            
                if (i != j) result.push({cost: 3, type: "alternatePrecedence", a: this.name(i), b: this.name(j), support: this.alternatePrecedenceSupport[i][j], contradictions: this.alternatePrecedenceContradictions[i][j]});                            
                for (var k of this.activityIDToName.keys())
                {
                    if (i != j && i != k) result.push({cost: 5, type: "disjunctiveResponse", a: this.name(i), b: this.name(j) + " or " + this.name(k), support: this.disResponseSupport[i][j][k], contradictions: this.disResponseContradictions[i][j][k]});            
                    if (i != j && i != k && j != k) result.push({cost: 5, type: "conjunctiveResponse", a: this.name(i) + " and " + this.name(j), b: this.name(k), support: this.conResponseSupport[i][j][k], contradictions: this.conResponseContradictions[i][j][k]});                                
                }
            }
        }          
        result.sort(function(a, b){return b.support.length - a.support.length});
        result.sort(function(a, b){return a.cost - b.cost});
        result.sort(function(a, b){return a.contradictions.length - b.contradictions.length});

        this.resultsCache = result;
        return result;

    }

    costOf(gm)
    {
        var result = 0;
        for (let r of gm)
        {
            result += r.cost;
        }
        return result;
    }


    get unsoundGreedyModel()
    {
        var result = new Set();
        var coveredTraces = new Set();
        var contradictedTraces = new Set();

        for (let r of this.results())
        {
            if (r.contradictions.length == 0 && r.support.length > 0)        
            {                             
                for (var s of r.support)
                {
                    if (!coveredTraces.has(s))
                    {
                        result.add(r);
                        coveredTraces.add(s);
                    }
                }
            }
        }

        for (let r of this.results())
        {
            if (r.contradictions.length > 0 && r.support.length > 0)        
            {   
                var con = 0;
                var sup = 0;     

                for (var s of r.support)                
                    if (!coveredTraces.has(s))                    
                        sup++;

                for (var s of r.contradictions)                
                    if (!contradictedTraces.has(s))                    
                        con++;

                if(sup > con) 
                {
                    result.add(r);
                    for (var s of r.support)                
                        if (!coveredTraces.has(s))                    
                            coveredTraces.add(s);    

                    for (var s of r.contradictions)                
                        if (!contradictedTraces.has(s))                    
                            contradictedTraces.add(s);    
                }                       
            }
        }

        return result;
    }

    get greedyModel()
    {
        var result = new Set();
        var coveredTraces = new Set();

        for (let r of this.results())
        {
            if (r.contradictions.length == 0 && r.support.length > 0)        
            {                             
                for (var s of r.support)
                {
                    if (!coveredTraces.has(s))
                    {
                        result.add(r);
                        coveredTraces.add(s);
                    }
                }
            }
        }
        return result;
    }

    get supports()
    {
        var result = new Set();
        for (let r of this.results())
        {
            if (r.contradictions.length == 0 && r.support.length > 0)        
            {
                for (var s of r.support)
                {             
                    result.add(s);
                }
            }
        }
        return  Array.from(result);
    }
   
    name(i)
    {
        return this.activityIDToName.get(i)
    }
   
    render()
    {
        var gm = this.greedyModel;
        var usgm = this.unsoundGreedyModel;

        var result = ``;

        result += `Results for the Greedy Minimizer (GM): </br>`

        result += `<table class="resultTable">
        <tr>
          <th>Type</th>
          <th>Activity 1</th>          
          <th>Activity 2</th>          
          <th>Support (Results in True Negatives)</th>
          <th>Contradictions (Results in False Negatives)</th>
        </tr>`;
        for (let r of this.results())
        {
            if (gm.has(r))
            {
                result += `  <tr>
                <td>${r.type}</td>
                <td>${r.a}</td>
                <td>${(r.b !== undefined) ? r.b : "N/A"}</td>
                <td>${r.support}</td>
                <td>${r.contradictions}</td>`            
                result += `</tr>`;
            }
        }

        result += `</table>`;

        result += `</br></br>`
        result += `Results for the Unsound Greedy Minimizer (allows less than perfect recall if accuracy can thereby be improved): </br>`

        result += `<table class="resultTable">
        <tr>
          <th>Type</th>
          <th>Activity 1</th>          
          <th>Activity 2</th>          
          <th>Support (Results in True Negatives)</th>
          <th>Contradictions (Results in False Negatives)</th>
        </tr>`;
        for (let r of this.results())
        {
            if (usgm.has(r))
            {
                result += `  <tr>
                <td>${r.type}</td>
                <td>${r.a}</td>
                <td>${(r.b !== undefined) ? r.b : "N/A"}</td>
                <td>${r.support}</td>
                <td>${r.contradictions}</td>`            
                result += `</tr>`;
            }
        }

        result += `</table>`;        


        var tset = new Set();
        var gmSup = 0;       
        var gmSize = 0; 
        for (var r of gm)
        {
            for (var s of r.support)
                tset.add(s);
            gmSize++;
        }
        gmSup = tset.size;


        var tset = new Set();
        var tset2 = new Set();
        var usgmSup = 0;  
        var usgmCon = 0;  
        var usgmSize = 0; 
        for (var r of usgm)
        {
            for (var s of r.support)
                tset.add(s);
            for (var s of r.contradictions)
                tset2.add(s);                
            usgmSize++;
        }        
        usgmSup = tset.size;
        usgmCon = tset2.size;

        result += `</br></br>`

        result += `<table class="modelsTable">
        <tr>
          <th>Type</th>
          <th>TPR (Recall)</th>          
          <th>TNR (Specificity)</th>          
          <th>Accuracy</th>
          <th>Balanced Accuracy</th>
          <th>Precision</th>
          <th>F1</th>
          <th>ModelSize</th>
        </tr>`;


        
        var TP = this.log.positiveTraceCount;        
        var FN = 0;        
        var FP = this.log.negativeTraceCount - gmSup;        
        var TN = gmSup;
        var PPV = (TP / (TP + FP));
        var TPR = (TP / (TP + FN));
        var F1 = 2 * ((PPV * TPR) / (PPV + TPR));
        var TNR = (TN / (TN + FP));
        var ACC = ((TP + TN) / (TP + FP + FN + TN));
        var BACC = ((TPR + TNR) / (2));
        var size = gmSize;

        result += `  <tr>
        <td>GM</td>
        <td>${TPR}</td>
        <td>${TNR}</td>
        <td>${ACC}</td>        
        <td>${BACC}</td>      
        <td>${PPV}</td>
        <td>${F1}</td>
        <td>${size}</td>`            
        result += `</tr>`;


        TP = this.log.positiveTraceCount - usgmCon;        
        FN = usgmCon;        
        FP = this.log.negativeTraceCount - usgmSup;        
        TN = usgmSup;
        PPV = (TP / (TP + FP));
        TPR = (TP / (TP + FN));
        F1 = 2 * ((PPV * TPR) / (PPV + TPR));
        TNR = (TN / (TN + FP));
        ACC = ((TP + TN) / (TP + FP + FN + TN));
        BACC = ((TPR + TNR) / (2));
        size = usgmSize;

        result += `  <tr>
        <td>UGM</td>
        <td>${TPR}</td>
        <td>${TNR}</td>
        <td>${ACC}</td>      
        <td>${BACC}</td>        
        <td>${PPV}</td>
        <td>${F1}</td>
        <td>${size}</td>`            
        result += `</tr>`;


        result += `</table>`;

        return result;
    }
    
}