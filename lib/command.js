define(['require', 'exports', './cli-parser/js/parser.js', './stream', './events'], function(require, exports, cliParser, Stream, events) {
	var CLIParser = cliParser.Parser;
	var EventEmitter = events.EventEmitter;
	
	var inherits = function(ctor, superCtor) {
	  ctor.super_ = superCtor;
	  ctor.prototype = Object.create(superCtor.prototype, {
		constructor: {
		  value: ctor,
		  enumerable: false,
		  writable: true,
		  configurable: true
		}
	  });
	};
	
	var CommandRunner = exports.CommandRunner = (function() {
		function CommandRunner(terminal) {
			this.terminal = terminal;
			this.env = this.terminal.env;
			this.commandParser = new CommandParser(this.env);
			this.fs = this.terminal.fs;
			
			EventEmitter.call(this);
		}
		
		inherits(CommandRunner, EventEmitter);
		
		CommandRunner.prototype.pipeTo = function pipeTo(from, to) {
			for(pipeName in from) {
				if(to[pipeName] && from[pipeName]) {
					from[pipeName].pipe(to[pipeName]);
				}
			}
		};
		
		CommandRunner.prototype.run = function run(cmd, curDir) {
			var cmdFiles, cmds, runCmd, pipes, tmpPipes, nextPipes, pipeList, toPipes, rtnCode, self;
			
			self = this;
			cmds = this.commandParser.parse(cmd);
			cmdFiles = cmds.map(function(cmd) {
				return { file: self.terminal.findCMD(cmd.args[0], curDir), joiner: cmd.joiner, args: cmd.args.slice(1), str: cmd.str, name: cmd.args[0] };
			});
			//pipes = this.createPipes();
			pipeList = [];
			
//			return [cmds, cmdFiles, cmd];
			
//			this.emit('command:run', pipes);
			
			/*for(i = 0; i < cmdFiles.length; i++) {
				tmpPipes = this.createPipes();
				
				pipeList.push(tmpPipes);
				
				this.pipeTo(tmpPipes, pipes);
				
				if(nextPipes) {
					this.pipeTo(nextPipes, tmpPipes);
				} else if(cmdFiles[i].joiner == '|') {
					nextPipes = pipes;
//					pipes = this.createPipes();
					
				}
				
				rtnCode = this.execFile(cmdFiles[i].file, cmdFiles[i].args, tmpDir);
			}*/
			
			var runContext = this.terminal.createRunContext(cmdFiles);
			
			for(i = cmdFiles.length - 1; i >= 0; i--) {
				tmpPipes = /*'args: ' + cmdFiles[i].args.join() + ' joiner: ' + cmdFiles[i].joiner*//*this.createPipes()*/runContext.createCMDContext(cmdFiles[i]);
				
				if(!toPipes) {
					toPipes = tmpPipes;
					this.emit('command:run', toPipes);
				}
				
				if(cmdFiles[i].joiner == '|') {
//					this.pipeTo(tmpPipes, toPipes);
					tmpPipes.pipeTo(toPipes);
					
					toPipes = tmpPipes;
				}
				
				this.execFile(cmdFiles[i].file, cmdFiles[i].args, tmpPipes);
			}
		};
		
		/*CommandRunner.prototype.createPipes = function createPipes(additional) {
			var pipes = {};
			
			pipes.view = new Stream();
			pipes.data = new Stream();
			pipes.err  = new Stream();
			
			if(additional) {
				for(var i = 0; i < additional.length; i++) {
					pipes[additional[i]] = new Stream();
				}
			}
			
			return pipes;
		};*/
		
		CommandRunner.prototype.execFile = function execFile(file, args, context) {
			if(!this.fs.isExec(file)) return new Error("Not executable");
			
			if(file.command && typeof(file.command.exec) == 'function') {
				file.command.exec(args, context);
			} else if(file.contents && file.contents.length && file.contents.length > 0) {
				try {
					console.log('shell:', this.fs.pathTo(file), this.run(file.contents));
				} catch(e) {
					console.error('shell:', this.fs.pathTo(file), e, e.message, e.stack);
				}
			}
		};
		
		return CommandRunner;
	})();
	
	var CommandParser = exports.CommandParser = (function() {
		function CommandParser(env) {
			this.env = env;
			this.cliParser = new CLIParser();
		}
		
		CommandParser.prototype.splitCommands = function splitCommand(cmdLine) {
			var curChar, splits, i, inStr, split, chars, curSplit;
			
			splits = [];
			split = [];
			chars = cmdLine.split('');
			
			for(i = 0; i < cmdLine.length; i++) {
				curChar = chars[i];
				
				if(!inStr && (curChar == '"' || curChar == "'")) {
					inStr = curChar;
				} else if(curChar == inStr) {
					inStr = undefined;
				} else if(!inStr && (chars[i - 1] != '\\' || chars[i - 2] == '\\')) {
					if(/^(?:\&|\|)$/.test(curChar) && chars[i + 1] == curChar) {
						splits.push({ type: curChar + chars[i + 1], index: i });
						i++;
					} else if(/^(?:\;|\||\n)$/.test(curChar)) {
						splits.push({ type: curChar, index: i });
					}
				} else if((i > 0 ? chars[i - 1] == '\\' : false) && (i > 1 ? chars[i - 2] != '\\' : true) && curChar == '\n') {
					chars.splice(i - 1, 1);
					i--;
				}
			}
			
			for(i = 0; i < splits.length; i++) {
				curSplit = splits[i];
				
				split.push({ str: chars.slice(i > 0 ? splits[i - 1].index + splits[i - 1].type.length : 0, curSplit.index).join('').trim(), joiner: i > 0 ? splits[i - 1].type : '^' });
			}
			
			split.push({ str: chars.slice(!!curSplit ? curSplit.index + curSplit.type.length : 0).join('').trim(), joiner: curSplit ? curSplit.type : '^' });
			
			return split;
		};
		
		CommandParser.prototype.parse = function parse(cmdLine) {
			var cmds, self;
			
			self = this;
			cmds = this.splitCommands(cmdLine);
			
//			return this.cliParser.parse(cmd, this.env.vars);
			return cmds.map(function(cmd) {
				return { args: self.cliParser.parse(cmd.str, self.env.vars), str: cmd.str, joiner: cmd.joiner };
			}).filter(function(cmd) {
				return cmd.str && cmd.str.length > 0 && cmd.joiner && cmd.joiner.length > 0 && cmd.args && cmd.args.length > 0;
			});
		};
		
		return CommandParser;
	})();
});