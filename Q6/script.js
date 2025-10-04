function getTimestamp() {
        return new Date().toISOString();
    }

    function getObjectType(target) {
        if (target.tagName === 'BUTTON') return 'button';
        if (target.tagName === 'IMG') return 'image';
        if (target.tagName === 'SELECT') return 'drop_down';
        if (target.tagName === 'A') return 'link';
        if (target.tagName === 'INPUT') return 'input_field';
        return 'text/other';
    }

    console.log({
        timestamp: getTimestamp(),
        type_of_event: "view",
        event_object: "page_load"
    });

    document.addEventListener("click", function(event) {
        console.log({
            timestamp: getTimestamp(),
            type_of_event: "click",
            event_object: getObjectType(event.target)
        });
    });