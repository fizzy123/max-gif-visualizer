inlets = 1;
outlets = 0;

var liveObject = new LiveAPI("live_set");
var preload = []
var videos = []
var scenes = []
var enabled = []
var old_enabled = []
var slabs = []
var mywindow = new JitterObject("jit.window","gifs");
mywindow.size = [1920, 1080]
mywindow.fullscreen = true
//mywindow.fsmenubar = false
var videoplanes = []
var myvideoplane, mymatrix, chroma_slab

// create a [jit.gl.render] object for drawing into our window:
var myrender = new JitterObject("jit.gl.render","gifs");
myrender.ortho = 2;
myrender.erase_color = [0, 0, 0, 1];

var blend_dict = new Dict;
blend_dict.import_json('blend.json')
blend_dict = JSON.parse(blend_dict.stringify())

var initial_scene = 0

var dummy_matrix = new JitterMatrix(4, "char")

for (var i=0;i<16;i++) {
	chroma_slab = new JitterObject("jit.gl.slab","gifs");
    chroma_slab.inputs = 1
    chroma_slab.file = "co.chromakey.jxs"
    chroma_slab.param("tol", 0.1)
    chroma_slab.param("fade", 0.1)
    chroma_slab.param("mode", 0)
    chroma_slab.param("binary", 0)
    slabs.push(chroma_slab)
    
	videos.push(new JitterObject("jit.movie"))
	videos[i].output_texture = 1
	videos[i].drawto = "gifs"
	preload.push(new JitterObject("jit.movie"))
	preload[i].output_texture = 1
	preload[i].drawto = "gifs"
    myvideoplane = new JitterObject("jit.gl.videoplane", "gifs")
    myvideoplane.blend_enable = 1
    myvideoplane.depth_enable = 0
    myvideoplane.layer = i + 19
	videoplanes.push(myvideoplane)
	scenes.push(initial_scene)
	enabled.push(false)
	old_enabled.push(true)
}
enabled[0] = true

function log() {
  for(var i=0,len=arguments.length; i<len; i++) {
    var message = arguments[i];
    if(message && message.toString) {
      var s = message.toString();
      if(s.indexOf("[object ") >= 0) {
        s = JSON.stringify(message);
      }
      post(s);
    }
    else if(message === null) {
      post("<null>");
    }
    else {
      post(message);
    }
  }
  post("\n");
}

function get(obj, key) {
  if (!obj) {
    return obj
  }
  if (key in obj) {
    return obj[key]
  } else {
	return null
  }
}

function beat(beats) {
  var solid_layer = 0;
  for (var i=15;i>-1;i--) {
	if (enabled[i] && (solid_layer <= i || (get(get(blend_dict, videos[i].moviename), 'chromakey')))) {
       videoplanes[i].enable = 1
      var tempo = liveObject.get('tempo')
      var effective_frames = videos[i].framecount
      var end = get(get(blend_dict, videos[i].moviename), 'end')
      var start = get(get(blend_dict, videos[i].moviename), 'start')
      if (start && end) {
	    effective_frames = end - start + 1
	  } else if (end) {
		effective_frames = end + 1
	  } else if (start) {
	    effective_frames = videos[i].framecount - start
      }
      
      var beats_per_loop = get(get(blend_dict, videos[i].moviename), 'beats_per_loop')
      if (!beats_per_loop) {
        beats_per_loop = Math.round((effective_frames/videos[i].framecount) * videos[i].duration/1000 / (60 / tempo))
        if (beats_per_loop === 3) {
	      beats_per_loop = 2
	    } else if (beats_per_loop === 5) {
		  beats_per_loop = 4
        } else if (beats_per_loop === 7 || beats_per_loop === 9) {
	      beats_per_loop = 8
	    }
      }
      log(beats_per_loop)
      var ratio = (beats - beats_per_loop * Math.floor(beats/beats_per_loop))/beats_per_loop

      var temp_frame = Math.floor(start + ratio * effective_frames)
      if (get(get(blend_dict, videos[i].moviename), 'offset')) {
	    temp_frame = (temp_frame + blend_dict[videos[i].moviename]['offset']) % effective_frames
      }
      log(temp_frame)
      videos[i].frame_true(temp_frame)
      videos[i].matrixcalc(dummy_matrix, dummy_matrix)
      if (get(get(blend_dict, videos[i].moviename), 'blend')) {
	    videoplanes[i].blend_enable = 1
	    videoplanes[i].blend = blend_dict[videos[i].moviename]['blend']
      } else {
	    videoplanes[i].blend = "alphablend"
	  }
      if (get(get(blend_dict, videos[i].moviename), 'chromakey')) {
	    if (get(get(blend_dict, videos[i].moviename), 'tol') !== null) {
	      slabs[i].param('tol', blend_dict[videos[i].moviename]['tol'])
        } else {
	      slabs[i].param('tol', 0.1)
	    }
	    slabs[i].param("color", blend_dict[videos[i].moviename]['chromakey'])
	    slabs[i].jit_gl_texture(videos[i].texture_name)
	    slabs[i].draw()
	    videoplanes[i].jit_gl_texture(slabs[i].capture); 
	    if (videoplanes[i].layer < 16 + 19) {
 		  videoplanes[i].layer = videoplanes[i].layer + 16
        }
      } else {
        videoplanes[i].jit_gl_texture(videos[i].texture_name)
	    if (videoplanes[i].layer > 15 + 19) {
 		  videoplanes[i].layer = videoplanes[i].layer - 16
        }
        solid_layer = i
	  }
	  old_enabled[i] = true
    } else {
	  if (old_enabled[i] === true && (enabled[i] === false || solid_layer > i)) {
        videoplanes[i].enable = 0
	    videoplanes[i].blend = "alphablend"
	    old_enabled[i] = false
	  }
	}
  }
  // rendering block...
  myrender.erase(); // erase the drawing context
  myrender.drawclients(); // draw the client objects
  myrender.swap(); // swap in the new drawing
}

var map_midi_to_video = {}
map_midi_to_video[48] = 0
map_midi_to_video[49] = 1
map_midi_to_video[50] = 2
map_midi_to_video[51] = 3
map_midi_to_video[44] = 4
map_midi_to_video[45] = 5
map_midi_to_video[46] = 6
map_midi_to_video[47] = 7
map_midi_to_video[40] = 8
map_midi_to_video[41] = 9
map_midi_to_video[42] = 10
map_midi_to_video[43] = 11
map_midi_to_video[36] = 12
map_midi_to_video[37] = 13
map_midi_to_video[38] = 14
map_midi_to_video[39] = 15

function update(note, velocity) {
//  log("note: ", note)
//  log("velocity: ", velocity)
  if (note >= 36 && note <= 51) {
	var key = map_midi_to_video[note]
	if (key === 0) {
	  if (velocity) {
	    enabled[key] = false
      } else {
	    enabled[key] = true
	  }
	} else {
	  if (velocity) {
	    enabled[key] = true
      } else {
	    enabled[key] = false
	  }
	}
  } else if (velocity) {
  	channel = note % 16
  	signal = Math.floor(note / 16)
  	if (signal === 1) {
	  var old = videos[channel]
	  videos[channel] = preload[channel]

	  preload[channel] = old
	  preload[channel].dispose()
	  width = videos[channel].moviedim[0]
	  height = videos[channel].moviedim[1]
	  if (width >= height) {
	    videoplanes[channel].scale = [width/height, 1, 1]
	  } else if (width < height) {
	    videoplanes[channel].scale = [1, height/width, 1]
	  }
    } else if (signal === 0) {
	  scenes[channel]++
	  preload[channel].asyncread(scenes[channel] + "-" + channel + ".mov")
    }
  }
}

function is_playing(status) {
  if (status === 0) {
	scenes = []
	for (var i=0;i<16;i++) {
	  scenes.push(initial_scene)
	}
  } else if (status === 1) {
    log('test')	
    blend_dict = new Dict;
	blend_dict.import_json('blend.json')
    blend_dict = JSON.parse(blend_dict.stringify())
  }
}