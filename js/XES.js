class XESFile
{
    cachedActivities = new Set();
    tracesCache;
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

    anonymize()
    {
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
    foldedTraces = [];


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

        return this.nameCache;
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
        result += "\t<log id=\"" + newId + "\">\n";
        for(var t of this.traces)
        {        
            i++;
            result += t.anonymize(i, actMap);
        }     
        result += "\t</log>\n";
        return result;
    }    


    shuffle(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;
      
        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
      
          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
      
          // And swap it with the current element.
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }
      
        return array;
      }

    foldTraces(n)
    {
        this.foldedTraces = [];
        var c = this.traces.length;
        var l = c / n;
        var o = c % n;


        var i = 0;
        var j = 0;
        var temp = [];


        var traces = [];
        for(var t of this.traces)
        {
            traces.push(t);
        }

        traces = this.shuffle(traces);

        for(var t of traces)
        {        
            i++;
            temp.push(t);            
            if ((j < o && i > l) || (j >= o && i >= l))
            {
                j++;
                this.foldedTraces.push(temp);
                temp = [];
                i = 0;                
            }
        }
        while  (j < n)
        {
            this.foldedTraces.push(temp);
            temp = [];            
            j++;
        }        
    }

    trainingSet(n)
    {
        var result = [];
        var i = 0;
        for(var t of this.foldedTraces)
        {            
            if (i != n)
                result = result.concat(t); 
            i++;
        }
        return result;
    }    
    
    testSet(n)
    {
        return this.foldedTraces[n];
    }

}


class XESTrace
{
    node;
    eventsCache;
    nameCache;
    labelCache;


    constructor(source, node) 
    {
        this.xes = source;
        this.node = node;
    }

    get events()
    {
        if (this.eventsCache === undefined)
            this.eventsCache = _.map(this.node.getElementsByTagName("event"), x => new XESEvent(this.xes, x));
        return this.eventsCache;
    }  
    
    get label()
    {
        if (this.labelCache === undefined)        
            this.labelCache =  this.xes.evaluate(".//*[@key='label']/@value[1]", this.node, null, XPathResult.STRING_TYPE).stringValue;

        if (this.labelCache == "")
            if (this.node.attributes.getNamedItem("type") !== null)
                this.labelCache = this.node.attributes.getNamedItem("type").value;                        

        return this.labelCache;
    }

    isPositive()
    {
        if (this.label == "Forbidden")
            return false;
        else
            return true;
    }

    isNegative()
    {
        if (this.label == "Forbidden")
            return true;
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


    anonymize(newId, actMap)
    {        
        var result = "";        
        result += "\t\t<trace id=\"" + newId + "\" type=\"" + this.node.attributes.getNamedItem("type").value + "\">\n";
        for(var e of this.events)
        {       
            result += e.anonymize(actMap);
        }     
        result += "\t\t</trace>\n";
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
        result += "\t\t\t<event id=\"" + actMap.get(this.conceptName) + "\"/>\n";
        return result;
    }      


}
