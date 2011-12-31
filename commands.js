var IO = require( './IO.js' ).IO,
	bot = require( './bot.js' ).bot;

var parseCommandArgs = (function ( args ) {

	var state, inString, prev;

	var handleChar = function ( ch ) {
		var ret;

		if ( state === 'escape' ) {
			ret = ch;
			state = 'data';
		}

		else if ( ch === '"' ) {
			inString = !inString;
			state = 'data';
			ret = '';
		}

		else if ( ch === '\\' ) {
			ret = '';
			state = 'escape';
		}

		else if ( ch === ' ' && !inString ) {
			if ( prev === ' ' ) {
				ret = '';
			}
			else {
				ret = 'NEW';
			}
		}

		else if ( state === 'data' ) {
			ret = ch;
		}

		prev = ch;

		return ret;
	};

	return function ( args ) {
		var ret = [],
			arg = '',
			ch,
			pos = 0, len = args.length,
			whatToDo;
		
		state = 'data';
		inString = false;

		while ( pos < len ) {
			ch = args[ pos++ ];
			whatToDo = handleChar( ch );

			if ( whatToDo === 'NEW' ) {
				ret.push( arg );
				arg = '';
			}
			else {
				arg += whatToDo;
			}
		}
		ret.push( arg );

		if ( inString ) {
			throw new Error( 'Unexpected end of input' );
		}

		return ret;
	};

}());

var commands = {
	alive : function () {
		return 'I LIVE!';
	},

	die : function () {
		if ( this.stopped ) {
			return 'Kill me once, shame on you, kill me twice...';
		}
		bot.stop();
		return 'You killed me!';
	},

	forget : function ( args, msgObj ) {
		if ( !bot.commandExists(args) ) {
			return 'Command ' + args + ' does not exist';
		}

		if ( !bot.commands[args].canDel(msgObj.user_name) ) {
			return 'You are not authorized to delete the command ' + args;
		}

		delete bot.commands[ args ];
		return 'Command ' + args + ' was forgotten.';
	},

	mdn : function ( args ) {
		var parts = args.trim().split( '.' ),
			base = 	'https://developer.mozilla.org/en/',
			url;

		console.log( args, parts, 'mdn input' );

		if (
			parts[0] === 'document' ||
			parts[0] === 'Node' ||
			parts[0] === 'element'
		) {
			url = base + 'DOM/' + args;
			console.log( url, 'mdn DOM' );
		}

		else if ( process[parts[0]] ) {
			url = base +
				  'JavaScript/Reference/Global_Objects/' +
				  parts.join( '/' );
			console.log( url, 'mdn global' );
		}

		else {
			url = 'https://developer.mozilla.org/en-US/search?q=' + args;
			console.log( url, 'mdn unknown' );
		}

		return url;
	},

	jquery : function ( args ) {
		args = args.trim().replace( /^\$/, 'jQuery' );

		var parts = args.split( '.' ), exists = false, msg;
		//parts will contain two likely components, depending on the user input
		// user gave jQuery.prop - parts[0] will be jQuery, parts[1] will
		//  be prop
		// user gave prop - parts[0] will be prop
		// user gave jQuery.fn.prop - that's a special case

		console.log( args, parts, 'jQuery input' );

		//jQuery API urls works like this:
		// if it's on the jQuery object, then the url is /jQuery.property
		// if it's on the proto, then the url is /property

		//user gave something like jQuery.fn.prop, turn that to just prop
		if ( parts.length === 3 ) {
			parts = [ parts[2] ];
		}

		//check to see if it's a property on the jQuery object itself
		if ( parts[0] === 'jQuery' && jQuery[parts[1]] ) {
			exists = true;
		}

		//user wants something on the prototype?
		else if ( parts.length === 1 && jQuery.prototype[parts[0]] ) {
			exists = true;
		}

		//user just wanted a property? maybe.
		else if ( jQuery[parts[0]] ) {
			args = 'jQuery.' + parts[0];
			exists = true;
		}

		if ( exists ) {
			msg = 'http://api.jquery.com/' + args;
		}
		else {
			msg = 'Could not find specified jQuery property ' + args;
		}
		console.log( msg, 'jQuery link' );

		return msg;
	},

	online : function () {
		var avatars = document.getElementById('present-users')
				.getElementsByClassName('avatar');

		return [].map.call(
			avatars,
			function ( wrapper ) {
				return wrapper.children[ 0 ].title;
		}).join( ', ' );
	},


	user : function ( args, msgObj ) {
		var senderID = msgObj.user_id;
		return 'http://stackoverflow.com/users/' + ( args || senderID );
	}
};

commands.get = (function () {
var types = {
		answer : true,
		question : true,
	},
	range = {
		//the result array is in descending order, so it's "reversed"
		first : function ( arr ) {
			return arr[ arr.length - 1 ];
		},
		last : function ( arr ) {
			return arr[ 0 ];
		},
		between : function ( arr ) {
			//SO api takes care of this for us
			return arr;
		}
	};

return function ( args, msgObj ) {
	var parts = parseCommandArgs( args ),
		type = parts[ 0 ],
		plural = type + 's',

		relativity = parts[ 1 ] || 'last',
		start, end,

		usrid = parts[ 2 ] || msgObj.user_id;

	//if "between" is given without the optional user_id, then assume the
	// sender's id
	if ( relativity === 'between' && isNaN(Number(usrid)) ) {
		usrid = msgObj.user_id;
	}

	console.log( parts, 'get input' );

	if ( !types.hasOwnProperty(type) ) {
		return 'Invalid "getter" name ' + type;
	}
	if ( !range.hasOwnProperty(relativity) ) {
		return 'Invalid range specifier ' + relativity;
	}

	var url = 'http://api.stackoverflow.com/1.1/users/' + usrid + '/' +
			plural + '?sort=creation';

	console.log( url, 'get building url' );

	if ( relativity === 'between' ) {
		start = Date.parse( parts[2] );
		end = Date.parse( parts[3] );
		url += '&fromdate=' + start + '&todate=' + end;

		console.log( url, 'get building url between' );
	}

	IO.jsonp({
		url : url,
		fun : parseResponse
	});

	return 'Retrieving ' + type;

	function parseResponse ( respObj ) {

		if ( respObj.error ) {
			bot.directReply( respObj.error.message, msgObj.message_id );
			return;
		}

		var relativeParts = [].concat( range[ relativity ]( respObj[plural] ) ),
			base = "http://stackoverflow.com/q/",
			res;

		console.log( relativeParts.slice(), 'get parseResponse parsing' );

		if ( relativeParts.length ) {
			res = relativeParts.map(function ( obj ) {
				console.log( obj );
				return base + ( obj[type + '_id'] || '' );
			}).join( ' ' );
		}
		else {
			res = 'User did not submit any ' + plural;
		}
		console.log( res, 'get parseResponse parsed');

		bot.directReply( res, msgObj.message_id );
	}
};
}());

commands.learn = (function () {

return function ( args ) {
	console.log( args, 'learn input' );

	var commandParts = parseCommandArgs( args ),
		command = {
			name   : commandParts[ 0 ],
			output : commandParts[ 1 ],
			input  : commandParts[ 2 ] || '.*',
			flags  : commandParts[ 3 ]
		};

	console.log( commandParts, 'learn parsed' );

	if ( !command.name || !command.input || !command.output ) {
		return 'Illegal /learn object ' + args;
	}

	if ( bot.commandExists(command.name) ) {
		return 'Command ' + command.name + ' already exists';
	}

	command.input= command.input.replace(
		/~./g,
		function ( c ) {
			c = c.charAt( 1 );
			if ( c === '~' ) {
				return '~';
			}
			return '\\' + c;
		}
	);

	var pattern;
	try {
		pattern = new RegExp( command.input, command.flags );
	}
	catch ( e ) {
		return e.message;
	}
	console.log( pattern );

	var out = command.output;

	bot.addCommand({
		name : command.name,
		fun : customCommand,
		description : 'User-taught command',
		permissions : {
			use : 'ALL',
			del : 'ALL'
		}
	});

	return 'Command ' + command.name + ' learned';

	function customCommand ( args, usr ) {
		console.log( args, command.name + ' input' );

		var msg = args.replace( pattern, function () {
			var parts = arguments;

			console.log( parts, command.name + ' replace #1' );

			return out.replace( /\$(\d+)/g, function ( $0, $1 ) {
				return parts[ $1 ];
			});
		});

		console.log( msg, command.name + ' output' );
		return msg;
	}
};
}());

Object.keys( commands ).forEach(function ( cmdName ) {
	bot.addCommand({
		name : cmdName,
		fun  : commands[ cmdName ],
		permissions : {
			del : 'NONE'
		}
	});
});