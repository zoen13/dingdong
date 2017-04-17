var mongoose=require('mongoose');

var infoSchema=mongoose.Schema({
	id:{
		type:String,
		unique:true,
		required:true
	},
	subsysid:String,
	title:String,
	createtime:String,
	isDone:String,
	RowKey:String

});

var info=module.exports=mongoose.model('info',infoSchema);

//get info
module.exports.getInfo=function(limit,callback){
	info.find({'isDone':'0'},callback).sort({'id':-1}).limit(limit);
};

//create info
module.exports.addInfo=function(Info,callback){
	info.create(Info,callback);
};

//get info by id
module.exports.getInfoByID=function(id,callback){
	//info.find({'id':id}).count();
};

//findOneAndUpdate
module.exports.updateInfo=function(Info,callback){
	info.findOneAndUpdate({'id':Info.id},Info,callback);
};
