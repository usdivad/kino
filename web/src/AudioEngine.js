var AudioEngine = (function(ae) {
/*
    Conductor object. A glorified Metronome.

    Input vars:
    - bpm = beats per minute (tempo)
    - timesig = time signature; currently includes multiple bars, e.g. 4 bars of 13/4 makes a timesig of 13*4=52
    - players = an array of loops
    - transitionBeats = beats that are allowed to transition to another section

    - function_downbeat = function that is called on beat 1 of the bar
    - function_upbeat = function that is called on every other beat of the bar
    - function_stop = function that is called when metronome is stopped

    Default vars:
    - all_loaded = whether or not all players' Loops have been loaded
    - next{Bpm, Interval...} = the equivalent vars to be set for the next section
    - metroFunction = function that defines how the conductor's metronome treats beats
    - metro = the metronome itself
*/

//Constructor
ae.Conductor = function(bpm, timesig, transitionBeats, players, function_downbeat, function_upbeat, function_stop) {
    var conductor = this;
    this.bpm = bpm;
    this.interval = "BPM" + this.bpm + " L4";
    this.timesig = timesig;
    this.players = players;
    this.transitionBeats = transitionBeats;
    this.all_loaded = false;
    console.log(this.bpm);
    
    this.toNext = false;
    this.nextBpm = this.bpm;
    this.nextInterval = this.interval;
    this.nextTimesig = this.timesig;
    this.nextTransitionBeats = this.transitionBeats;
    this.nextPlayers = this.players;

    //functions
    this.function_stop = function_stop;
    this.function_downbeat = function_downbeat;
    this.function_upbeat = function_upbeat;

    // Metro construct (use "conductor" not "this" to point at Conductor)
    this.metroFunction = function(count) {
        var beat = count % conductor.timesig;

        // Available transition beats
        if (conductor.transitionBeats.indexOf(beat) >= 0) {
            console.log(beat + " is a transition beat in " + conductor.transitionBeats.toString());
            
            // Transition beat + transition state
            if (conductor.toNext) {
                //stop current
                conductor.pausePlayers();
                // conductor.fadeOutPlayers(0.1, 100);
                conductor.toggleTail(true);
                conductor.playPlayers(beat);
                conductor.metro.stop();

                //set next
                conductor.bpm = conductor.nextBpm;
                conductor.interval = "BPM" + conductor.bpm + " L4";
                conductor.metro = T("interval", {interval:conductor.interval}, conductor.metroFunction);
                conductor.timesig = conductor.nextTimesig;
                conductor.transitionBeats = conductor.nextTransitionBeats;
                conductor.players = conductor.nextPlayers;

                //reset globs
                conductor.metro.count = 0; //hacky
                conductor.toNext = false;
                console.log("transitioned toNext");
                conductor.resetPlayers();

                //play new
                conductor.metro.start();
                // conductor.playPlayers();
            }
            // Downbeat; transition beat but not transition state
            else if (beat == 0) {
                conductor.function_downbeat();
                conductor.playPlayers(beat);
            }
            // console.log("beep");
        }
        // Downbeat but not transition beat
        else if (beat == 0) {
            conductor.function_downbeat();
            conductor.playPlayers(beat);
        }
        // Upbeats
        else {
            conductor.function_upbeat();
            // console.log("boop");
        }
        console.log(beat);
    };

    this.metro = T("interval", {interval: conductor.interval}, this.metroFunction);
}

// Start from beat 0
ae.Conductor.prototype.start = function() {
    // this.playPlayers();
    this.checkAllLoaded();
    if (this.all_loaded) {
        this.resetPlayers();
        this.metro.start();
    }
    else {
        console.log("loops not yet all loaded; try again later~");
    }
}

// Stop everything
ae.Conductor.prototype.stop = function() {
    this.pausePlayers();
    this.metro.stop();
    this.function_stop();
}

// Play all individual players (doesn't affect metronome)
ae.Conductor.prototype.playPlayers = function(beat) {
    for (var i=0; i<this.players.length; i++) {
        this.players[i].play(beat);
    }
}

// Pause all individual players (but metronome continues)
ae.Conductor.prototype.pausePlayers = function() {
    for (var i=0; i<this.players.length; i++) {
        this.players[i].pause();
        // this.players[i].fadeOut(0.1, 100, true);
    }
}

// Reset all players
ae.Conductor.prototype.resetPlayers = function() {
    for (var i=0; i<this.players.length; i++) {
        this.players[i].reset();
    }
}

// Fade out all players
ae.Conductor.prototype.fadeOutPlayers = function(step, interval) {
    for (var i=0; i<this.players.length; i++) {
        this.players[i].fadeOut(step, interval);
    }
}

// Determine whether players' tails should be played
ae.Conductor.prototype.toggleTail = function(tf) {
    for (var i=0; i<this.players.length; i++) {
        this.players[i].playTail = tf;
    }
}

// Check if all player samples for this section have been loaded
ae.Conductor.prototype.checkAllLoaded = function() {
    // console.log("--");
    if (this.all_loaded) {
        console.log("- already all loaded");
        return;
    }
    else {
        // Check each player
        for (var i=0; i<this.players.length; i++) {
            // console.log("- player " + i);
            var loop = this.players[i];
            // Check init and loop
            if (loop.init && loop.loop && loop.init.isLoaded && loop.loop.isLoaded) {
                // console.log("- loaded both " + loop.url_init + " and " + loop.url_loop);
                
                // Check tail
                for (var j=0; j<loop.tail.length; j++) {
                    if (!(loop.tail[j].audio && loop.tail[j].audio.isLoaded)) {
                        console.log("- haven't loaded " + loop.tail[j].url);
                        this.all_loaded = false;
                        return;
                    }
                    else {
                        // console.log("- loaded " + loop.tail[j].url);
                    }
                }
                // console.log("- finished checking init,loop, and tail");
            }
            else {
                console.log("- haven't loaded one of either " + loop.url_init + " or " + loop.url_loop);
                this.all_loaded = false;
                return;
            }
        }
        console.log("- all loaded");
        // this.all_loaded = true;
        // return;
    }
    // console.log("--");
}


/*
    Loop object.

    Either constructed with an init sound + loop or just loop.
    Note that the loop audio may have a tail as well

    Input vars:
    - init = the initial audio (first play)
    - loop = the looped audio
    - tail = an array of {url, audio, beats} objects:
             e.g. [{url: 'x.mp3', audio: T("audio"), beats: [10, 18]}]
        - audio: the T("audio")
        - beats: an array of valid beats for that audio to be played (based on transitionBeats)
    
    Default vars:
    - initPlayed = whether init has been played yet
    - playTail = whether tail should be played
    
    - activated = whether loop is "activated" or not within current cycle (on/off ctrl)
    - url_{init, loop} = URLs of init and loop audio files

    - defaultMul = default amplitude (for beginning of section)
    - mul = current amplitude

    (- mute/unmute is similar to on/off but takes place immediately)
*/
ae.Loop = function(init, loop, tail, defaultMul) {
    this.init = ae.to_audio(init);    
    this.loop = ae.to_audio(loop);
    // this.tail = ae.to_audio(tail);
    this.tail = tail;
    for (var i=0; i<this.tail.length; i++) {
        this.tail[i].audio = ae.to_audio(tail[i].url);
    }
    this.activated = true;

    this.initPlayed = false;
    this.playTail = false;
    this.url_init = init;
    this.url_loop = loop;

    this.defaultMul = 1;
    if (defaultMul !== undefined) {
        this.defaultMul = defaultMul;
    }
    this.mul = this.defaultMul;

}

//Play/pause
ae.Loop.prototype.play = function(beat) {
    if (!this.activated) {
        return;
    }
    if (this.playTail) {
        // Determine which tail sample to play
        for (var i=0; i<this.tail.length; i++) {
            tail = this.tail[i];
            if (tail.beats.indexOf(beat) >= 0) {
                tail.audio.play();
                tail.audio.bang();
                console.log("playing tail: " + tail.url + " on beat " + beat);
                return;
            }
        }
        console.log("invalid beat " + beat);

        // this.activated = false;
    }
    else if (this.initPlayed) {
        this.loop.play();
        this.loop.bang();
        console.log("playing loop: " + this.url_loop);
    }
    else {
        this.init.play();
        this.init.bang();
        this.initPlayed = true;
        console.log("playing init: " + this.url_init);
    }
}

ae.Loop.prototype.pause = function() {
    this.loop.pause();
    this.init.pause();
    for (var i=0; i<this.tail.length; i++) {
        this.tail[i].audio.pause();
    }
    this.initPlayed = false;
}

//Reset; prepare for next play session
ae.Loop.prototype.reset = function() {
    //Settings for time
    this.loop.currentTime = 0;
    this.init.currentTime = 0;
    for (var i=0; i<this.tail.length; i++) {
        this.tail[i].audio.currentTime = 0;
    }

    //Settings for which audio stream to play
    this.initPlayed = false;
    this.playTail = false;

    // Settings for activation and volume
    this.on();
    // this.unmute();
    this.setMul(this.defaultMul);
}

//On/off activation for current cycle
ae.Loop.prototype.on = function() {
    this.activated = true;
}
ae.Loop.prototype.off = function() {
    this.activated = false;
}

//Volume control (immediate effect)
ae.Loop.prototype.setMul = function(mul) {
    this.loop.mul = mul;
    this.init.mul = mul;
    for (var i=0; i<this.tail.length; i++) {
        this.tail[i].audio.mul = mul;
    }
    this.mul = mul;
}
ae.Loop.prototype.mute = function() {
    // var table = [1, [0, 1500]];
    // var env = T("env", {table: table});
    // this.setMul(env);

    this.setMul(0);
}

ae.Loop.prototype.unmute = function() {
    // this.setMul([0, [1, 1500]]);

    this.setMul(1);
}

// Fade in/out over time
ae.Loop.prototype.fadeOut = function(step, interval) {
    var loop = this;
    var timer = setInterval(function() {
        if (loop.mul <= 0) {
            clearInterval(timer);
            console.log("fadeOut done");
            // if (pause) {
            //     loop.pause();
            // }
        }
        else {
            loop.setMul(loop.mul);
            loop.mul -= step;
        }
        console.log(loop.mul);
    }, interval);
}

ae.Loop.prototype.fadeIn = function(step, interval) {
    var loop = this;
    var timer = setInterval(function() {
        if (loop.mul >= 1) {
            clearInterval(timer);
            console.log("fadeIn done");
        }
        else {
            loop.setMul(loop.mul);
            loop.mul += step;
        }
        console.log(loop.mul);
    }, interval);
}

/*
    Audio wrapping; converts audio from URLs to T("audio") objects
*/

//Regular audio
ae.to_audio = function(url) {
    return T("audio").loadthis(url, function() {
        console.log("Done loading " + url);
    }, function() {
        console.log("Failed to load " + url);
    });
}

//Loop
ae.to_loop = function(url) {
    return T("audio", {loop: true}).loadthis(url, function() {
        console.log("Done loading " + url);
    }, function() {
        console.log("Failed to load " + url);
    });
}


/**
    Helper functions
**/

//BPM to milliseconds
ae.btom = function(bpm) {
    // return Math.round(((60/bpm)*1000)*100000) / 100000;
    return (((60/bpm)*1000)*100000) / 100000;
}

return ae;

}(AudioEngine || {}));