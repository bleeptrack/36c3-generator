class StateSaver {

	constructor(string) {
		this.newRNG = true;
		this.nrs = [];
		this.nrsbackup = [];
		console.log(string);
		if(string){
			this.newRNG = false;
			this.nrs = JSON.parse(string);
			this.nrsbackup = [...this.nrs];
			this.nrs.reverse(); //reverse for easy pap later
		}
	}
	
	getLength(){
		return this.nrs.length;
	}
	
	getSeed(){
		return JSON.stringify(this.nrs);
	}
	
	hasNextNr(){
		
		return !this.newRNG && this.nrs.length>0 ? true : false;
	}
	
	saveUserInput(nr){
		this.nrs.push(nr);
	}
	
	removeLast(x){
		this.nrs.splice(this.nrs.length-x, this.nrs.length);
	}
	
	getNextInt(min, max){
		if(this.newRNG){
			var nr = this.rnd(min, max);
			this.saveUserInput(nr);
			return nr;
		}else{
			//console.log(this.intnrs);
			var val = this.nrs.pop();
			if(this.getLength()==0){
				this.nrs = [...this.nrsbackup];
				this.newRNG = true;
			}
			return val;
			
		}
	}
	

	
	//returns a random Int between min and max
	rnd(min, max) {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}
