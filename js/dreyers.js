class Dreyers 
{
    
    constructor()
    {
        
    }   
    
    CSVtoXES(csv)
    {        
        var rows = csv.split("\r\n");
        var cases = new Map();       
                
        for (var r of rows)
        {
            var cols = r.split(";");
            var ID = cols[0];
            var Event = cols[1];
            var Title = cols[2];

            if(!cases.has(ID))
            {
                cases.set(ID, []);
            }

            if (Title != "NULL")
                cases.get(ID).push(Title);
            else if (Event == "RestartWorkflow")
                cases.get(ID).push(Event);
        }


        var traces = [];
        for (let [k, v] of cases)
        {            
            var events = [];
            var i = 1;
            for (var e of v)
            {
                if (e ==  "RestartWorkflow")
                {
                    var trace = {id: k + "_N" + i, events: events, label: "Forbidden"};
                    traces.push(trace);
                    events = [];
                    i++;
                }
                else
                {
                    events.push(e);
                }
            }
            var trace = {id: k + "_P", events: events, label: "Required"};
            traces.push(trace);
        }

        // Clear ambiguous traces
        
        var bad = new Set();
        var neg = new Set();
        var pos = new Set();
        for (var t of traces)
        {            
            var s  = "";
            for (var e of t.events)
            {
                s += e + ", ";

            }           


            if (t.label == "Forbidden")
            {                
                neg.add(s);
                if (pos.has(s))            
                    bad.add(s);                
            }
            else    
            {
                pos.add(s);
                if (neg.has(s))            
                    bad.add(s);                
            }

        }


        var newTraces = [];

        var cBadPos = 0;
        var cBadNeg = 0;
        // remove bad ones...
        for (var t of traces)
        {            
            var s  = "";
            for (var e of t.events)
            {
                s += e + ", ";

            }

            if (!bad.has(s))
            {
                newTraces.push(t);
            }

            if (bad.has(s))
            {
                if (t.label == "Forbidden")
                    cBadNeg++;
                else    
                    cBadPos++;
            }
        }

        traces = newTraces;



        // to XES

        var result = `<?xml version="1.0" encoding="UTF-8" ?>\n`;                   
        result += `<log xes.version="1.0" xes.features="nested-attributes">                
    <extension name="Concept" prefix="concept" uri="http://www.xes-standard.org/concept.xesext"/>
    <classifier name="Event Name" keys="concept:name"/>
    `              
        result += "<string key=\"concept:name\" value=\"" + "DreyersLogLabelled" + "\"/>\n";

        for (var t of traces)
        {
            result += "\t<trace>\n";
            result += "\t\t<string key=\"concept:name\" value=\"" + t.id + "\"/>\n";
            result += "\t\t<string key=\"label\" value=\"" + t.label + "\"/>\n";
            for (var e of t.events)
            {
                result += "\t\t<event>\n";
                result += "\t\t\t<string key=\"concept:name\" value=\"" + e + "\"/>\n";
                result += "\t\t</event>\n";        
            }
            result += "\t</trace>\n";
        }

        result += "</log>\n";        

        return result;
    }
    
}