paper.install(window);

//timestamp of simulation start and end
var startTime = 0;
var endTime = 0;

//colors from styleguide
var concreteColor = '#D0D0CE';
var textColor = '#FE5000';
var leafColor = '#00BB31';

//Shapes
var concreteObjects = [];
var leaves = [];
var animatedLeaves = [];
var physicObjects = [];
var physicObjectsAngles = [];
var captionObjects = [];
var crackPoint;
var mousepos;

//matter.js settings
var staticFriction = 0.3;
var density = 100;
var friction = 0.5;
var groundheight = 800;
var counter = 0;

var Engine = Matter.Engine,
	Events = Matter.Events,
	Render = Matter.Render,
	World = Matter.World,
	Bodies = Matter.Bodies;

var engine;
var runner;


//generator state
var restart = true;
var simulationRunning = true;
var hope = false;
var pathIsText = true;
var uploadedSVG;
var captionText = [];
var simText = "36c3";
var simSVG = "";
var animation = false;
var moveCaption = false;

//RNG
var state = new StateSaver();

var url = new URL(window.location.href);
var seed = url.searchParams.get("seed");
var eT = url.searchParams.get("time");
var cT = url.searchParams.get("caption");
var txt = url.searchParams.get("text");
var anim = url.searchParams.get("animation");

if(seed){
	state = new StateSaver(seed);
}
if(eT){
	endTime = parseFloat(eT);
}
if(cT){
	captionText = cT.split(",");
}
if(txt){
	simText = txt;
}
if(anim){
	animation = true;
}



// for sharing modal
var modal;
var span;

window.onload = function() {
	paper.setup('paperCanvas');

	if(animation){
		var menue = document.getElementsByClassName("menue")[0];
		menue.style.display = "none";
		var zoom = document.getElementsByClassName("zoom")[0];
		zoom.style.display = "none";
		var infobox = document.getElementById("infobox");
		infobox.style.display = "none";
	}


	//modal stuff
	// Get the modal
	modal = document.getElementById("myModal");

	// Get the <span> element that closes the modal
	span = document.getElementsByClassName("close")[0];

	//moveCaptionButton = document.getElementById("moveCaption");

	// When the user clicks on <span> (x), close the modal
	span.onclick = function() {
	modal.style.display = "none";
	}

	// When the user clicks anywhere outside of the modal, close it
	window.onclick = function(event) {
		if (event.target == modal) {
			modal.style.display = "none";
		}
	}




	// create a physics engine
	engine = Engine.create({
		enableSleeping: true
	});

	// run the engine
	var runner = Matter.Runner.create({
		//delta: 1000 / 60,
		isFixed: true,
		enabled: true
	});
	Matter.Runner.run(runner, engine);

	// run the renderer
	// uncomment for debugging
	//Render.run(render);

	//Mouse events for adding cracks
	view.onMouseDown = function(event) {
		mousepos = event.point;

		if(simulationRunning){
			return;
		}
		
		captionObjects.forEach(function(capObj){
			if(capObj.contains(mousepos)){
				moveCaption = true;
			}
		});

		if(crackPoint && !moveCaption){
			handleCrack(true, mousepos);
			return;
		}
		
		
	}

	//update red position dot when mouse is moved
	view.onMouseMove = function(event) {
		if(crackPoint){
			mousepos = event.point;

			if(!simulationRunning){
				var o = getClosestPoint(mousepos);

				if(o.point){
					crackPoint.position = o.point;
				}

			}
		}
	}
	
	view.onMouseUp = function(event){
		moveCaption = false;
	}



	setAnimationFunction();
}

/*function toggleMoveCaption(){
	moveCaption = !moveCaption;
	if(moveCaption){
		moveCaptionButton.className = 'moveEnabled';
		document.getElementById("four").classList.add("disabled");
		document.getElementById("five").classList.add("disabled");
	} else{
		moveCaptionButton.className = 'moveDisabled';
		document.getElementById("four").classList.remove("disabled");
		document.getElementById("five").classList.remove("disabled");
	}
}*/

//apply physics engine simulation to paper.js animation
function setAnimationFunction(view){
	paper.view.onFrame = function(event){

		if(restart){
			clearSimulation();
			restart = false;
			if(pathIsText){
				simulateText(simText, detectSimulationEnd);
			}else{
				simulateSVG(uploadedSVG, detectSimulationEnd);
			}
		}

		if(simulationRunning){
			if(engine.timing.timestamp-startTime < parseFloat(endTime) || endTime == 0){ //slightly noise
				for(var i = 0; i<concreteObjects.length; i++){
						//console.log
					var size = [physicObjects[i].bounds.max.x-physicObjects[i].bounds.min.x, physicObjects[i].bounds.max.y-physicObjects[i].bounds.min.y];
					var physicbounds = new Rectangle(physicObjects[i].bounds.min, size);
					if(!physicObjects[i].isSleeping){
						concreteObjects[i].applyMatrix = true;
						concreteObjects[i].position = physicbounds.center;
						concreteObjects[i].rotate( (physicObjects[i].angle - physicObjectsAngles[i]) * (180/Math.PI));
						physicObjectsAngles[i] = physicObjects[i].angle;
					}

				}
			}else{
				console.log("stop");
				stopSimulation();
				console.log(endTime-engine.timing.timestamp);
			}

		}
	}
}

//create or draw Cracks depending on if a new simulation or a replay
function handleCrack(save, pos){

	if(save){
		state.saveUserInput(pos.x);
		state.saveUserInput(pos.y);

	}else{

		var ptx = state.getNextInt();
		var pty = state.getNextInt();
		pos = new Point(ptx, pty);
	}
	var o = getClosestPoint(pos);


	if(o.point){

		var insertpath;
		var startCP = false;
		var path = concreteObjects[o.idx];

		if(path._class=="CompoundPath"){
			var item = path.children[0].clone();
			item.insertAbove(path);
			item.fillColor = Color.random();
			insertpath = item;
			startCP = true;
		}else{
			insertpath = path;
		}
		var p = o.point;
		var timeout = 10;

		var rnglength = state.getLength();
		var crackobj = calcCrackShape(insertpath, p);
		var newshape = crackobj.newshape;
		var leaf = crackobj.leaf;
		var rnglength2 = state.getLength();

		if(newshape != null){//crack can be calculated here
			while(newshape._class=="CompoundPath" && timeout>0){
				console.log("removing last: "+rnglength2-rnglength);
				state.removeLast(rnglength2-rnglength);
				rnglength = rnglength2
				newshape.remove();
				leaf.remove();
				crackobj = calcCrackShape(insertpath, p);
				newshape = crackobj.newshape;
				leaf = crackobj.leaf;
				timeout--;
				rnglength2 = state.getLength();
			}

			if(newshape._class!="CompoundPath"){

				if(startCP){


					for(var i = 1; i<path.children.length; i++){
						console.log(i);
						var item = path.children[i].clone();
						console.log(item);

						var cut = newshape.subtract(item);
						newshape.remove();
						item.remove();
						newshape = cut;
					}
					newshape.fillColor = concreteColor;
					insertpath.remove();
				}
				concreteObjects[o.idx].remove();
				concreteObjects.splice(o.idx, 1);
				concreteObjects.push(newshape);

				leaves.push(leaf);
				leaf.remove();
				if(hope){//no worries, there's still hope ;)
					animateLeaf(leaf);
				}
			}
			crackPoint.bringToFront();
			captionObjects.forEach(function(item){
				item.bringToFront();
			});
			if(hope){
				animatedLeaves.forEach(function(item){
					item.bringToFront();
				});
			}
		}
	}
}

//add a caption
// isNew: should be true if a new caption (not a replay)
function setCaption(isNew){
	captionObjects.forEach(function(cap){
		cap.remove();
	});
	captionObjects = [];

	if(isNew){
		var caption = document.getElementById("caption").value.split('\n');
		if(caption.length==1 && caption[0]==""){
			captionText = [];
		}else{
			captionText = caption;
		}
	}
	console.log(captionText);
	if(captionText.length>0){
		var leftbound = getClosestPoint([paper.view.viewSize.width, paper.view.viewSize.height/2]);


		opentype.load("BO-2am.ttf", function(err, font) {

			captionText.forEach(function(text, i, arr){
				var shape = null;
				var fontpaths = font.getPaths(text,200,groundheight+i*100,100);

				for(var i = 0; i<fontpaths.length; i++){
					var paperpath = paper.project.importSVG(fontpaths[i].toSVG());
					if(hope){
						paperpath.fillColor = leafColor;
					}else{
						paperpath.fillColor = textColor;
					}
					if(shape){
						var newshape = shape.unite(paperpath);
						paperpath.remove();
						shape.remove();
						shape = newshape;
					}else{
						shape = paperpath;
					}
				}
				shape.bounds.topRight.x = leftbound.point.x;
				shape.rotate(state.rnd(0,10)-5);
				shape.onMouseDrag = function(event)  {
					if(moveCaption){
					event.target.bounds.topRight.x = event.target.bounds.topRight.x + event.delta.x;
					event.target.bounds.topRight.y = event.target.bounds.topRight.y + event.delta.y;
					}
				}
				captionObjects.push(shape);
			});
		});
	}
}

// finish physic simulation
function stopSimulation(){
	enableBoxes();
	simulationRunning=false;
	view.onFrame = null;
	endTime = engine.timing.timestamp-startTime;
	console.log("Simulation timestamp: "+engine.timing.timestamp);

	//console.log(state.getLength());
	while(state.hasNextNr()){
		handleCrack(false);
	}
	if(captionText.length>0){
		setCaption(false);
	}
}

//start a new simulation from user input text
function updateText(){

	var text = document.getElementById("simulationtext").value;
	document.title = text;

	if(text.length>0){
		clearSeed();
		setAnimationFunction();
		enableShare();

		simText = text;
		pathIsText = true;
		restart = true;
	}
}

//checks if the user pressed enter
function onEnter(event) {
	if (event.key === "Enter") {
		updateText();
	}
}

//user uploads a ons svg
function handleFiles(files){
	clearSeed();
	setAnimationFunction();
	disableShare();
	if(files){
		uploadedSVG = files[0];
		simSVG = files[0];
		document.title = files[0].name;
	}else{
		uploadedSVG = simSVG;
		document.title = simSVG.name;
	}
	pathIsText = false;
	restart = true;
}

//reset RNG
function clearSeed(){
	state = new StateSaver();
	captionText = [];
	endTime = 0;
	hope = false;
}

//reset physic simulation
function clearSimulation(){
	disableBoxes();
	concreteObjects = [];
	physicObjects = [];
	physicObjectsAngles = [];
	captionObjects = [];
	leaves = [];
	animatedLeaves = [];
	project.activeLayer.removeChildren();
	Matter.World.clear(this.engine.world);
	Matter.Engine.clear(this.engine);

	simulationRunning = true;
	moveCaption = false;

	var ground = Bodies.rectangle(-100, groundheight, 6400, 60, { isStatic: true });
	ground.frictionStatic = staticFriction;
	ground.friction = friction;
	ground.density = density*2;

	// add all of the bodies to the world
	World.add(engine.world, [ground]);


}

//Main Simulation Routine for text
function simulateText(text, finializeFunc){
	if(!state.newRNG){
		animationBoxes();
	}
	startTime = engine.timing.timestamp;
	console.log("startTime: "+startTime);

	opentype.load("BO-Midnight.ttf", function(err, font) {

		text = text.replace(/\s/g,'');

		var amount, glyph, ctx, x, y, fontSize;
		if (err) {
			console.log(err.toString());
			return;
		}

		mousepos = [100,100];
		crackPoint = new Path.Circle([-100,-100],5);
		crackPoint.fillColor = textColor;

		var textwidth = font.getAdvanceWidth(text, 500);
		var fontpaths = font.getPaths(text,(paper.view.viewSize.width-textwidth)/2,0,500);

		for(var i = 0; i<fontpaths.length; i++){

			if(fontpaths[i].commands == 0) continue;

			//import test as SVG into paper
			var boundingboxData = fontpaths[i].getBoundingBox();
			var boundingbox = new Rectangle([boundingboxData.x1, boundingboxData.y1], [boundingboxData.x2-boundingboxData.x1, boundingboxData.y2-boundingboxData.y1]);
			var paperpath = paper.project.importSVG(fontpaths[i].toSVG());
			paperpath.fillColor = '#DCDCDC';

			if(i==0){
				console.log(paper.view.bounds.x);
				console.log(boundingbox.bottomLeft.x);
				while(paper.view.bounds.x+200>boundingbox.bottomLeft.x){
					paper.view.zoom = paper.view.zoom-0.05;
					console.log(paper.view.bounds.x);
					console.log(boundingbox.bottomLeft.x);
				}
			}
			//paperpath = prepareLetter(paperpath, leanside);

			var rrad = (state.getNextInt(0,60)-30)/100;
			paperpath.rotate(rrad * (180/Math.PI));

			paperpath.bounds.bottomCenter = [boundingbox.center.x, groundheight-80];
			if(animation){
				paperpath.bounds.bottomCenter = [boundingbox.center.x, groundheight-380];
			}
			crackShapeObject(paperpath);

		}
		crackPoint.bringToFront();

		finializeFunc();
	});
}

//main simulation routine for user-defined SVG
function simulateSVG(svgstring, finializeFunc){
	mousepos = [100,100];
	crackPoint = new Path.Circle([100,100],5);
	crackPoint.fillColor = textColor;

	var svg = paper.project.importSVG(svgstring,{onLoad: svg => {handleSVG(svg); finializeFunc();}, onError: svgError, insert: true} );

	crackPoint.bringToFront();
}

function svgError(err){
	alert(err);
}

function handleSVG(svg){


		svg.scale(500/svg.bounds.height);
		svg.position = [paper.view.viewSize.width/2,320];
		for(var i = 0; i<svg.children.length; i++){
			if(!svg.children[i].type){
				var item = svg.children[i].clone();
				item.insertAbove(svg);

				if(svg.children[i]._class=="Group" ){
					handleSVG(item);
				}else{
					crackShapeObject(item);
				}
			}

		}
		svg.remove();

}

//adds a Path to the Engine World
function addToWorld(path){
	var vertices = paper2matter(path);
	var body = Bodies.fromVertices(path.bounds.center.x, path.bounds.center.y, vertices);
	if(body !== undefined){ //path with too few points can not be made to a body
		body.friction = friction;
		body.frictionStatic = staticFriction;
		body.density = density;

		World.add(engine.world, body);
		path.fillColor = concreteColor;
		concreteObjects.push(path);
		physicObjects.push(body);
		physicObjectsAngles.push(body.angle);
	}else{
		path.remove();
	}
}

function detectSimulationEnd() {
	for (var o of physicObjects) {
		Events.on(o, 'sleepStart sleepEnd', detectAllSleeping);
	}
}

function detectAllSleeping() {
	const amountOfSleepingObjects = physicObjects.filter(o => o.isSleeping).length;
	const sleepingPercentage = amountOfSleepingObjects / physicObjects.length;
	const allSleeping = physicObjects.every(o => o.isSleeping);
	console.log('allSleeping?', allSleeping, (sleepingPercentage * 100).toFixed(0) + '%');
	if (allSleeping && simulationRunning) {
		stopSimulation();
	}
}

//calculates and returns the closest point to pos on all paths in the simulation in addition with the shape index it belongs to
function getClosestPoint(pos){
	var closestPointByPath = [];
	var dists = [];
	for(var i = 0; i<concreteObjects.length; i++){
		var p = concreteObjects[i].getNearestPoint(pos); //p is null?
		if(concreteObjects[i]._class=="CompoundPath"){
			p = concreteObjects[i].children[0].getNearestPoint(pos);
		}
		if(p==null){
			console.log("p is null");
			console.log(concreteObjects[i]);
		}
		closestPointByPath.push(p);
		dists.push(p.subtract(pos).length);
	}


	var idx = dists.indexOf(Math.min(...dists));
	var ob = {
		point: closestPointByPath[idx],
		idx: idx
	};
	return ob;
}

//Breakes a path object into pieces and inserts them into the simulation
function crackShapeObject(path){
	var oldCenter = path.position;

	var crackedParts = breakPart(path, 0);
	var brokeparts = crackedParts[0];
	var letterparts = crackedParts[1];

	//ToDo: check if not null
	letterparts.forEach(function(path, idx, arr) {
			addToWorld(path);
	});

	brokeparts.forEach(function(path, idx, arr) {
			addToWorld(path);
	});
}

//Takes a path and returns a jittered version of it
function jitterPath(path){
	var newpath = new Path();
	var i = 0;
	while(i<path.length){
		var p = path.getPointAt(i);
		var n = path.getNormalAt(i);
		newpath.add(p.subtract(n.multiply(state.getNextInt(0,10))));
		i += state.getNextInt(8,15);
	}
	newpath.closed = path.closed;
	return newpath;
}

//calculates thin, long crack shape at certain point on path
function calcCrackShape(path, point){

	var offs = path.getOffsetOf(point);
	var n = path.getNormalAt(offs);
	var saven = n;

	var rotation = state.getNextInt(0,20)-40;
	n = n.rotate(rotation);
	var line = calcCrackLine(path, point, n, 15);
	var cutShape = calcCrackStencil(line, path.getTangentAt(offs), 25);
	var inters = cutShape.getIntersections(path);
	var leaf = createLeaves(inters, path, cutShape);
	if(leaf == null){
		//leaf could not be set
		cutShape.remove();
		return {newshape: null, leaf: null};
	}

	if(line.length>100){
		var rotation2 = state.getNextInt(0,20)-40;
		var idx = Math.floor(line.segments.length/2);
		var point2 = line.segments[idx].point;
		var line2 = calcCrackLine(path, point2, n.rotate(rotation2),0);
		var cutShape2 = calcCrackStencil(line2, n.rotate(rotation2).rotate(90), Math.floor(line.segments.length/2));
		cutShape2.insert(0, new Segment(cutShape.segments[idx].point,null,null));
		cutShape2.add(new Segment(cutShape.segments[cutShape.segments.length-idx-1].point,null,null));
		var newcutShape = cutShape.unite(cutShape2);
		var leafShape2 = leaf.children[0].unite(cutShape2);
		leaf.children[0].remove();
		leaf.removeChildren(0,1);
		leaf.insertChild(0,leafShape2);
		cutShape.remove();
		cutShape2.remove();
		cutShape = newcutShape;
	}



	var newshape = path.subtract(cutShape);
	cutShape.remove();
	return {newshape: newshape, leaf: leaf};

}

//creates leaves for hope state
function createLeaves(inters, originPath, leafShape){

	var calcLine = new Path();
	if(inters[0] === undefined){
		//leaf can not be calculated here
		return null;
	}

	calcLine.add(inters[0].point);
	calcLine.add(inters[inters.length-1].point);
	var point = calcLine.getPointAt(calcLine.length/2);
	var normal = calcLine.getNormalAt(calcLine.length/2);

	if(originPath.contains(point.add(normal.multiply(5)))){
		normal = normal.multiply(-1);
	}

	var middleLine = new Path();
	middleLine.strokeWidth = 6;
	middleLine.strokeColor = leafColor;
	middleLine.opacity = 0;
	var angle = normal.angle+90;
	if(angle>180){
		angle = angle-360;
	}
	var side = 1;
	if(angle<0){
		side = -1
	}

	var height = state.getNextInt(20,40);
	tip = point.add(normal.multiply(height));

	var l1 = state.getNextInt(15,20);
	var l2 = state.getNextInt(20,40);
	var l3 = state.getNextInt(45,70);
	var outerLine = new Path();
	outerLine.strokeColor = leafColor;
	outerLine.opacity = 0;
	outerLine.strokeWidth = 6;
	outerLine.add(point);
	outerLine.add(tip);
	outerLine.lineBy(0,-l1);
	outerLine.lineBy(side*l2,-l2);
	outerLine.lineBy(side*l3,0);

	var innerLine = new Path();
	innerLine.strokeColor = leafColor;
	innerLine.opacity = 0;
	innerLine.strokeWidth = 6;
	innerLine.add(tip);
	innerLine.lineBy(side*l2,-l2);
	innerLine.lineBy(side*l3*0.5,0);

	outerLine.add(new Point(innerLine.lastSegment.point.x, tip.y));
	outerLine.add(new Point(innerLine.segments[1].point.x, tip.y));

	var innerCircle = new Path.Circle(innerLine.lastSegment.point, 6);
	innerCircle.fillColor = leafColor;
	var outerCircle = new Path.Circle(outerLine.lastSegment.point, 6);
	outerCircle.fillColor = leafColor;

	var offs1 = leafShape.getOffsetOf(inters[0].point);
	var offs2 = leafShape.getOffsetOf(inters[inters.length-1].point);
	console.log(offs1+" "+offs2);
	var root = new Path();
	root.add(tip);
	root.add(inters[0].point);
	for(var i = 0; i<leafShape.segments.length; i++){
		var offs = leafShape.getOffsetOf(leafShape.segments[i].point);
		if(offs>offs1 && offs<offs2){
			root.add(leafShape.segments[i].point);
		}
	}
	root.add(inters[inters.length-1].point);
	root.fillColor = leafColor;
	root.opacity = 0;
	console.log(root);

	var leafGroup = new Group();
	leafGroup.addChild(root);
	leafGroup.addChild(innerLine);
	leafGroup.addChild(outerLine);
	leafGroup.addChild(innerCircle);
	leafGroup.addChild(outerCircle);
	return leafGroup;
}

//calculates the main line a crack runs along
function calcCrackLine(path, point, direction, backset){
	var line = new Path.Line(point.add(direction.multiply(backset)), point.add(direction.multiply(-500)));
	line.strokeColor = '#FF4500';
	line.strokeWidth = 3;

	var inters = line.getIntersections(path);
	var intersoffs = inters[1-inters.length%2].offset;
	var cutline = line.splitAt(intersoffs*state.getNextInt(50,80)/100);
	cutline.remove();
	line.remove();

	var jitterline = jitterPath(line);
	jitterline.strokeWidth = 3;
	jitterline.strokeColor = 'red';
	jitterline.closed = false;
	return jitterline;
}

//calculates a crack shape that will be cut out from the main shape
function calcCrackStencil(jitterline, tangent, maxwidth){

	var cutShape = new Path({
		fillColor: 'green'
	});

	var t = tangent;
	var wdth = jitterline.segments.length;
	for(var i = 0; i<jitterline.segments.length; i++){
		var p = jitterline.segments[i].point;
		var o = jitterline.getOffsetOf(p);

		var w = wdth;
		if(wdth>maxwidth){
			w = maxwidth;
		}

		if(i==jitterline.segments.length-1){
			cutShape.insert(i,new Segment(p, null, null));
		}else{
			cutShape.insert(i,new Segment(p.add(t.multiply(w)), null, null));
			cutShape.insert(i,new Segment(p.add(t.multiply(-w)), null, null));
		}
		wdth--;
	}
	cutShape.closed = true;
	jitterline.remove();
	return cutShape;
}

//calculatios a Shape, that should be broken of a path
function calcBreakShape(path){
	var boundspath = new Path();
	boundspath.add(path.bounds.bottomLeft);
	boundspath.add(path.bounds.topLeft);
	boundspath.add(path.bounds.topRight);
	boundspath.add(path.bounds.bottomRight);

	var size = state.getNextInt(boundspath.length/7,boundspath.length/3);
	//ToDo nichts oben abbrechen lassen?
	var o1 = state.getNextInt(0,boundspath.length-size);
	var o2 = (o1 + size) ;

	var p1 = boundspath.getPointAt(o1);
	var p2 = boundspath.getPointAt(o2);
	var n1 = boundspath.getNormalAt(o1);
	var n2 = boundspath.getNormalAt(o2);

	var breakshape = new Path();
	breakshape.add(new Segment(p1, null, n1.multiply(-state.getNextInt(80,130))));
	breakshape.add(new Segment(p2, n2.multiply(-state.getNextInt(80,130)), null));

	//fix for wrapping around path
	if(o2<o1){
		o2 += path.length;
	}
	for(var i = o2-10; i>o1; i-=10){
		breakshape.add(boundspath.getPointAt(i%path.length));
	}
	breakshape.closed = true;
	boundspath.remove();

	var jittershape = jitterPath(breakshape);
	breakshape.remove();

	return jittershape;
}

//Returns a random Point inside a path
function getPointInShape(shape){
	var point = shape.bounds.topLeft.add( shape.bounds.size.multiply( Point.random() ) );

	while(!shape.contains(point)){
		point = shape.bounds.topLeft.add( shape.bounds.size.multiply( Point.random() ) );
	}
	return point;
}

//Breakes a Part info pieces and returns them in a multidimensional array
// [0]: smaller parts that are broken away
// [1]: remaining "main" part(s)
function breakPart(path){
	var parts = [];
	var brokepath = new Path();
	var newpath = new Path();

	while(brokepath.segments && brokepath.segments.length<=0){
		newpath.remove();
		brokepath.remove();
		var breakStencil = calcBreakShape(path);
		newpath = path.subtract(breakStencil);
		brokepath = path.intersect(breakStencil);
	}


	if(brokepath._class=="CompoundPath"){
		var brokeparts = [];
		for(var i = 0; i<brokepath.children.length; i++){

			//if(item !== 'undefined'){
				var item = brokepath.children[i].clone();
				item.fillColor = concreteColor;
				item.insertAbove(brokepath);
				brokeparts.push(item);

			//}
		}
		parts.push(brokeparts);
		brokepath.remove();

	}else{
		parts.push([brokepath]);
	}

	if(newpath._class=="CompoundPath"){
		var newparts = [];

		for(var i = newpath.children.length-1; i>0; i--){ //check only second paths, not main path

			//if(item !== 'undefined'){
			if(!newpath.children[0].contains(newpath.children[i].position)){
				var item = newpath.children[i].clone();
				item.fillColor = concreteColor;
				item.insertAbove(newpath);
				newparts.push(item);
				newpath.children.splice(i,1);
			}
			//}
		}

		if(newpath.children.length > 1){ //still a compund path. has holes
			var item = newpath.clone();
			item.fillColor = concreteColor;
			item.insertAbove(newpath);
			newparts.push(item);
		}else{ //no compoundpath - just take the single path
			var item = newpath.children[0].clone();
			item.fillColor = concreteColor;
			item.insertAbove(newpath);
			newparts.push(item);
		}


		parts.push(newparts);
		newpath.remove();
	}else{
		parts.push([newpath]);
	}

	path.remove();
	breakStencil.remove();

	return parts;
}

//transforms a paper.js path into points for matter engine
function paper2matter(paperpath) {
	var pp;

	if(paperpath._class == "CompoundPath"){
		pp = paperpath.children[0].clone();
	}else{
		pp = paperpath.clone();
	}
	//paperpath.simplify(1);
	pp.flatten(4);
	var points = [];
	for(var i = 0; i<pp.segments.length; i++){
		var p = pp.segments[i].point;
		var vert = {
			x: p.x,
			y: p.y
		};
		points.push(vert);
	}
	pp.remove();
	return points;
}

//shuffles array elements
function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

//set destruction state
function setDestruction(){
	hope = false;
	for(var i = 0; i<animatedLeaves.length; i++){
		animatedLeaves[i].remove();
	}
	for(var i = 0; i<captionObjects.length; i++){
		captionObjects[i].fillColor = textColor;
	}
	animatedLeaves = [];
}

//set hope state (green leaves and stuff)
function setHope(){
	hope = true;
	var concrete = concreteObjects[concreteObjects.length -1];
	for(var i = 0; i<leaves.length; i++){
		//leaves[i].insertAbove(concrete);
		animateLeaf(leaves[i]);
	}
	for(var i = 0; i<captionObjects.length; i++){
		captionObjects[i].fillColor = leafColor;
	}
}

//animation for growing leaves
function animateLeaf(leafobject){
	var concrete = concreteObjects[concreteObjects.length -1];

	var innerstates = []
	var outerstates = []

	var tweenstate = leafobject.children[1].clone({insert: false});

	for(var x = 0; x<tweenstate.segments.length-1; x++){

		var ts = leafobject.children[1].clone({insert: false});
		for(var i = x; i<ts.segments.length; i++){
			ts.segments[i] = new Segment(ts.segments[x].point, null, null);
		}
		innerstates.push(ts);
	}

	var tweenstate2 = leafobject.children[2].clone({insert: false});

	for(var x = 0; x<tweenstate2.segments.length-1; x++){

		var ts = leafobject.children[2].clone({insert: false});
		for(var i = x; i<ts.segments.length; i++){
			ts.segments[i] = new Segment(ts.segments[x].point, null, null);
		}
		outerstates.push(ts);
	}

	var circlesmall1 = leafobject.children[3].clone({insert: false});
	circlesmall1.scale(0.01);
	var circlesmall2 = leafobject.children[4].clone({insert: false});
	circlesmall2.scale(0.01);
	var root1 = leafobject.children[0].clone({insert: false});

	var c1 = leafobject.children[3];
	tweenstate.insertAbove(concrete);
	tweenstate2.insertAbove(concrete);
	circlesmall1.insertAbove(concrete);
	circlesmall2.insertAbove(concrete);
	root1.insertAbove(concrete);

	animatedLeaves.push(tweenstate);
	animatedLeaves.push(tweenstate2);
	animatedLeaves.push(circlesmall1);
	animatedLeaves.push(circlesmall2);
	animatedLeaves.push(root1);


	var startTween = root1.tween({opacity: 0}, {opacity: 1}, {duration: state.rnd(150,350), start: false});
	startTween.start();
	startTween.then(function(){


		var tween = tweenstate.tween({strokeColor: leafColor, opacity: 1}, state.rnd(50,150));
		tween.onUpdate = function(event) {
			tweenstate.interpolate(innerstates[0], innerstates[1] , event.factor);
		};
		tween.then(function(){
			tween = tweenstate.tween(state.rnd(50,350));
			tween.onUpdate = function(event) {
				tweenstate.interpolate(innerstates[1], leafobject.children[1] , event.factor);
			};
			tween.then(function(){
				tween = circlesmall1.tween(state.rnd(50,350));
				tween.onUpdate = function(event) {
					circlesmall1.interpolate(circlesmall1, leafobject.children[3] , event.factor);
				};
			});
		});


		var tween2 = tweenstate2.tween({strokeColor: leafColor, opacity: 1}, state.rnd(50,150));
		tween2.onUpdate = function(event) {
			tweenstate2.interpolate(outerstates[0], outerstates[1] , event.factor);
		};
		tween2.then(function(){
			var tween3 = tweenstate2.tween(state.rnd(50,350));
			tween3.onUpdate = function(event) {
				tweenstate2.interpolate(outerstates[1], outerstates[2] , event.factor);
			};
			tween3.then(function(){
				tween2 = tweenstate2.tween(state.rnd(50,350));
				tween2.onUpdate = function(event) {
					tweenstate2.interpolate(outerstates[2], outerstates[3], event.factor);
				};
				tween2.then(function(){
					tween2 = tweenstate2.tween(state.rnd(50,350));
					tween2.onUpdate = function(event) {
						tweenstate2.interpolate(outerstates[3], outerstates[4], event.factor);
					};
					tween2.then(function(){
						tween2 = tweenstate2.tween(state.rnd(50,350));
						tween2.onUpdate = function(event) {
							tweenstate2.interpolate(outerstates[4], outerstates[5] , event.factor);
						};
						tween2.then(function(){
							tween2 = tweenstate2.tween(state.rnd(50,350));
							tween2.onUpdate = function(event) {
								tweenstate2.interpolate(outerstates[5], leafobject.children[2] , event.factor);
							};
							tween2.then(function(){
								tween2 = circlesmall2.tween(state.rnd(150,350));
								tween2.onUpdate = function(event) {
									circlesmall2.interpolate(circlesmall2, leafobject.children[4] , event.factor);
								};
							});
						});
					});
				});
			});
		});

	});

}

//creates sharing url and shows modal
function share(){
	urlstring = window.location.hostname+"?seed="+state.getSeed()+"&time="+endTime+"&caption="+encodeURIComponent(captionText.toString())+"&text="+encodeURIComponent(simText);
	console.log(urlstring);
	var textarea = document.getElementById("sharetext");
	textarea.value = urlstring;
	modal.style.display = "block";
}

//canvas zoom in
function zoomIn(){
	paper.view.zoom = paper.view.zoom+0.05;
}

//canvas zoom out
function zoomOut(){
	paper.view.zoom = paper.view.zoom-0.05;
}

//disable all boxed during replay
function animationBoxes(){
	document.getElementById("one").classList.add("disabled");
	document.getElementById("two").classList.add("disabled");
	document.getElementById("three").classList.add("disabled");
	document.getElementById("four").classList.add("disabled");
	document.getElementById("five").classList.add("disabled");
	document.getElementById("six").classList.add("disabled");
}

//enable second phase boxed
function enableBoxes(){
	document.getElementById("three").classList.remove("disabled");
	document.getElementById("four").classList.remove("disabled");
	document.getElementById("five").classList.remove("disabled");
	document.getElementById("six").classList.remove("disabled");
	document.getElementById("two").classList.add("disabled");

	document.getElementById("one").classList.remove("disabled");
}

//disable second phase boxes
function disableBoxes(){
	document.getElementById("three").classList.add("disabled");
	document.getElementById("four").classList.add("disabled");
	document.getElementById("five").classList.add("disabled");
	document.getElementById("six").classList.add("disabled");
	document.getElementById("two").classList.remove("disabled");

	document.getElementById("one").classList.remove("disabled");
}

//disable share button
function disableShare(){
	document.getElementById("shareButton").classList.add("disabled");
}

//enable share button
function enableShare(){
	document.getElementById("shareButton").classList.remove("disabled");
}

//let user download canvas content as SVG
function downloadSVG(){
	crackPoint.remove();
	paper.view.update();
    var svg = project.exportSVG({ asString: true, bounds: 'content' });
    var svgBlob = new Blob([svg], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = simText+".svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
	crackPoint.insertAbove(concreteObjects[concreteObjects.length-1]);
}

//let user download canvas content as PNG
function downloadPNG(){
	crackPoint.remove();
	paper.view.update();
    var canvas = document.getElementById("paperCanvas");
    var downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png;base64");
    downloadLink.download = simText+'.png';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
	crackPoint.insertAbove(concreteObjects[concreteObjects.length-1]);
}
