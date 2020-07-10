class LogFile
{   
    logsCache;

    constructor(source) 
    {
        var parser = new DOMParser();
        this.xes =  parser.parseFromString(source, "text/xml");
    }

    get logCount()
    {
        return this.xes.evaluate( 'count(//log)', this.xes).numberValue;
    }


    get logs()
    {        
        if (this.logsCache === undefined)
            this.logsCache = _.map(this.xes.getElementsByTagName("log"), x => new XESLog(this.xes, x));

        return this.logsCache;
    }   

    cleanTime()
    {
        for(var l of this.logs)        
            l.cleanTime()                
    }

    cleanType()
    {
        for(var l of this.logs)        
            l.cleanType()                
    }    

    cleanInconsistent()
    {
        for(var l of this.logs)        
            l.cleanInconsistent()                
    }

    cleanNoNegative()
    {
        var newLogsCache = [];
        for(var l of this.logs)        
        {
            if (l.negativeTraceCount > 0)
                newLogsCache.push(l);
            else
                console.log("Removing log: " + l.conceptName);
        }
        this.logsCache = newLogsCache;
    }    

    anonymize()
    {
        console.log("Cleaning time...")
        this.cleanTime();

        console.log("Cleaning optional or missing types...")
        this.cleanType();

        console.log("Cleaning inconsistent traces...")
        this.cleanInconsistent();

        console.log("Cleaning logs without negative traces...")
        this.cleanNoNegative();

        console.log("Anonimyzing...")
        var i = 0;

        var zip = new JSZip();
        for(var l of this.logs)
        {  
            i++;      
            zip.file("log_" + i + ".xes", l.anonymize(i));            
        }     
        zip.generateAsync({type:"blob"})
        .then(function(content) {            
            saveAs(content, "logs.zip");
        });
    }
}


class XESLog
{
    node;    
    tracesCache;
    nameCache;    
    cachedActivities = new Set();    
    negativeTraceCountCache;
    positiveTraceCountCache;


    constructor(source, node) 
    {
        this.xes = source;
        this.node = node;
    }

    get traceCount()
    {
        return this.xes.evaluate( 'count(//trace)', this.node).numberValue;        
    }

    get negativeTraceCount()
    {
        if (this.negativeTraceCountCache === undefined)
        {
            this.negativeTraceCountCache = 0;
            for (var t of this.traces)
            {
                if (t.isNegative())
                    this.negativeTraceCountCache++;
            }
        }
        return this.negativeTraceCountCache;
    }    

    get positiveTraceCount()
    {        
        if (this.positiveTraceCountCache === undefined)
        {
            this.positiveTraceCountCache = 0;
            for (var t of this.traces)
            {
                if (t.isPositive())
                    this.positiveTraceCountCache++;
            }
        }
        return this.positiveTraceCountCache;
    }    


    get traces()
    {        
        if (this.tracesCache === undefined)
            this.tracesCache = _.map(this.node.getElementsByTagName("trace"), x => new XESTrace(this.xes, x));

        return this.tracesCache;        
    }

    get activities()
    {
        if (this.cachedActivities.size > 0)
            return this.cachedActivities;
        
        var iterator = document.evaluate(".//event//*[@key='concept:name']/@value", this.node, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null );

        try {
            var thisNode = iterator.iterateNext(); 
            while (thisNode) {
                this.cachedActivities.add(thisNode.nodeValue);
                thisNode = iterator.iterateNext();
            } 
        }
        catch (e) {
            console.log( 'Error: Document tree modified during iteration ' + e );
        }

        if (this.cachedActivities.size == 0)
        {

            var iterator = document.evaluate(".//event/@id", this.node, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null );

            try {
                var thisNode = iterator.iterateNext(); 
                while (thisNode) {
                    this.cachedActivities.add(thisNode.nodeValue);
                    thisNode = iterator.iterateNext();
                } 
            }
            catch (e) {
                console.log( 'Error: Document tree modified during iteration ' + e );
            }
        }

        return this.cachedActivities;        
    }

    get conceptName()
    {

        if (this.nameCache === undefined)
            this.nameCache = this.xes.evaluate(".//*[@key='concept:name']/@value[1]", this.node, null, XPathResult.STRING_TYPE).stringValue;

        if (this.nameCache == "")
            if (this.node.attributes.getNamedItem("id") !== null)
                this.nameCache = this.node.attributes.getNamedItem("id").value;

        if (this.nameCache == "")
            if (this.node.attributes.getNamedItem("Id") !== null)
                this.nameCache = this.node.attributes.getNamedItem("Id").value;                       

        return this.nameCache;
    }  
    
    
    cleanInconsistent()
    {
        var activityIDToName = new Map();
        var activityNameToID = new Map();    
        var pos = new Set();
        var neg = new Set();
        
        var i = 0;
        for (var a of this.activities)
        {
            activityIDToName.set(i, a);
            activityNameToID.set(a, i);
            i++;
        }

        var inconsistentLogs = new Set();        

        for (var t of this.traces)            
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
                if (pos.has(x))
                {                    
                    inconsistentLogs.add(x);                                                            
                }
                neg.add(x);                                    
            }
            if (t.isPositive())
            {
                if (neg.has(x))                    
                {
                    inconsistentLogs.add(x);                    
                }
                pos.add(x);                                    
            }                                    
        }

        var newTracesCache = [];
        for(var t of this.traces)        
        {
            var x = "";
            for (var e of t.events)            
            {
                var n = e.conceptName;                
                var id = activityNameToID.get(n);
                x += id + "-";                
            }

            if(inconsistentLogs.has(x))
            {                
                console.log("Removing trace: " + t.conceptName);                
            }
            else
            {
                newTracesCache.push(t);
            }
        }       
        this.tracesCache = newTracesCache;        
    }
    

    cleanType()
    {
        var newTracesCache = [];
        for(var t of this.traces)        
        {
            if(t.type === undefined || t.type === "Optional")
            {
                console.log("Removing trace: " + t.conceptName);
            }
            else
            {
                newTracesCache.push(t);
            }
        }       
        this.tracesCache = newTracesCache;
    }    


    cleanTime()
    {
        var newTracesCache = [];
        for(var t of this.traces)        
        {
            if(t.containsTime())
            {
                console.log("Removing trace: " + t.conceptName);
            }
            else
            {
                newTracesCache.push(t);
            }
        }       
        this.tracesCache = newTracesCache;
    }    

    anonymize(newId)
    {
        var actMap = new Map();
        var nId = 0;
        for (var n of this.activities)
        {
            nId++;
            actMap.set(n, nId);
        }
        var i = 0;
        var result = `<?xml version="1.0" encoding="UTF-8" ?>\n`;           
        result += `<log xes.version="1.0" xes.features="nested-attributes">                
    <extension name="Concept" prefix="concept" uri="http://www.xes-standard.org/concept.xesext"/>
    <classifier name="Event Name" keys="concept:name"/>
    `              
        result += "<string key=\"concept:name\" value=\"" + newId + "\"/>\n";

        for(var t of this.traces)
        {     
                i++;
                result += t.anonymize(i, actMap);
        }     
        result += "</log>\n";
        return result;
    }    

}


class XESTrace
{
    node;
    eventsCache;
    nameCache;
    isConsistent;

    constructor(source, node) 
    {
        this.xes = source;
        this.node = node;
        this.isConsistent = true;
    }

    get events()
    {
        if (this.eventsCache === undefined)
            this.eventsCache = _.map(this.node.getElementsByTagName("event"), x => new XESEvent(this.xes, x));
        return this.eventsCache;
    }  
    
    isPositive()
    {
        if (this.node.attributes.getNamedItem("type") !== null)
            return this.node.attributes.getNamedItem("type").value == "Required";
        else
            return true;
    }

    isNegative()
    {
        if (this.node.attributes.getNamedItem("type") !== null)
            return this.node.attributes.getNamedItem("type").value == "Forbidden";
        else
            return false;            
    }    


    get conceptName()
    {

        if (this.nameCache === undefined)
            this.nameCache = this.xes.evaluate(".//*[@key='concept:name']/@value[1]", this.node, null, XPathResult.STRING_TYPE).stringValue;

        if (this.nameCache == "")
            this.nameCache = this.node.attributes.getNamedItem("id").value;

        return this.nameCache;

    }    


    get type()
    {
        if (this.node.attributes.getNamedItem("type") !== null)
            return this.node.attributes.getNamedItem("type").value;
        else
            return undefined;
    }


    containsTime()
    {
        for(var e of this.events)
        {       
            if (e.conceptName === undefined || e.conceptName == "")
                return true;
        }     
        return false;   
    }

    anonymize(newId, actMap)
    {        
        var result = "";        
        result += "\t<trace>\n";
        result += "\t\t<string key=\"concept:name\" value=\"" + newId + "\"/>\n";
        result += "\t\t<string key=\"label\" value=\"" + this.type + "\"/>\n";
        for(var e of this.events)
        {       
            result += e.anonymize(actMap);
        }     
        result += "\t</trace>\n";
        return result;
    }        

    
}


class XESEvent
{
    node;
    nameCache;

    constructor(source, node) 
    {
        this.xes = source;
        this.node = node;
    }

    get conceptName()
    {

        if (this.nameCache === undefined)
            this.nameCache = this.xes.evaluate(".//*[@key='concept:name']/@value[1]", this.node, null, XPathResult.STRING_TYPE).stringValue;

        try
        {
            if (this.nameCache == "")
                this.nameCache = this.node.attributes.getNamedItem("id").value;
        }
        catch(err)
        {
            console.log("No id found: ")
            console.dirxml(this.node);
        }

        return this.nameCache;
    }    

    anonymize(actMap)
    {        
        var result = "";        
        result += "\t\t<event>\n";
        result += "\t\t\t<string key=\"concept:name\" value=\"" + actMap.get(this.conceptName) + "\"/>\n";
        result += "\t\t</event>\n";
        return result;
    }      


}
