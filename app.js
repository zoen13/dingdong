var express=require('express');
var app=express();
var bodyParser=require('body-parser');
var mongoose=require('mongoose');
var path = require('path');
var rp = require('request-promise');
var qiniu = require("qiniu");
//var iconv = require('iconv-lite');

info = require('./models/info');

mongoose.connect('mongodb://admin:smghd1376@localhost:30000/info');
var db=mongoose.connection;

//将public目录下的所有内容作为可静态访问和下载的内容
app.use(express.static(path.join(__dirname, 'public')));
//以下两句是为了能让程序解析出post上来的数据
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 


//crontab每分钟执行一次获取QB中特定系统的稿件
app.get('/qb',function(req,res){
    var subsysid = new Array();
    //subsysid.push("23dcf989-a6cd-4bd5-91ed-887e108833a8");//新闻
    //2d5f73fb-5db5-4015-83df-46297caf2fe6    //私家车
    //d7a15fa6-aef5-41cf-a3ac-83e129cfb4de    //音乐
    //87d3ec50-0e10-4361-a5b6-ee9200e2dedc    //故事
    //30ffc5e0-e286-4a37-862c-1339be63d33d    //文艺
    //fca3cd65-0ef1-4ee0-9b05-beb210622e8c    //交通
    //f7feeede-46d0-45d1-86d8-4503fe48aded    //经济
    //7f60e7a3-81c9-48b3-b49e-b39b0238c8fb    //叮咚
    subsysid.push("7f60e7a3-81c9-48b3-b49e-b39b0238c8fb");


    for (var i=0;i<subsysid.length;i++){
        //console.log(subsysid[i]);
        doSubsys(subsysid[i]);
    }

    function doSubsys(subsysid){
        var rp = require('request-promise');
        var options = {
            method:'post',
            uri:'http://jnmi.a-radio.cn/QBservice/pages/QBClient/listinfo.do',
            //子系统id号
            qs:{subsysid:subsysid},
            headers:{
                'User-Agent': 'Request-Promise'
            },
            json:true
        };
        rp(options).then(function(data){
            
            var arr = new Array();
	    arr = data.result;
            //console.log(data);
	    //将取到的数据写入info数据库中，标记为未处理
                for (var o=0;o<arr.length;o++){
                    var infoObject = new Object();
                    infoObject.id = arr[o].id;
                    infoObject.subsysid = subsysid;
                    infoObject.title = arr[o].title;
                    infoObject.createtime = arr[o].createtime;
                    infoObject.isDone = "0";

                    info.addInfo(infoObject,function(err,infoObject){
                        if (err){
                            throw err;
                        }
                        res.json(infoObject);
                    });
                }
        });
    }
    
});

//crontab每分钟执行一次，处理mongodb中还没入库到叮咚的数据
app.get('/upload',function(req,res){
    //取出未处理的稿件信息
    info.getInfo(100,function(err,infos){
        if(err){
            throw err;
        }
        //对取到的每一条稿件进行处理
        for (var i=0; i<infos.length; i++){
            doInfo(infos[i].subsysid,infos[i].id);
            //console.log(infos[i]);
        }
    });  

    //doInfo("23dcf989-a6cd-4bd5-91ed-887e108833a8","58e731e70cf20d26fa3cd394");
    //doInfo("23dcf989-a6cd-4bd5-91ed-887e108833a8","58eb28180cf20d26fa3cec8e");
    //doInfo("23dcf989-a6cd-4bd5-91ed-887e108833a8","58dcfc3d0cf219bbd131688d");
    //doInfo("23dcf989-a6cd-4bd5-91ed-887e108833a8","58e5fbcd0cf219bbd1319e9f");
    //doInfo("23dcf989-a6cd-4bd5-91ed-887e108833a8","58de158a0cf219bbd13170f5");
    //doInfo("23dcf989-a6cd-4bd5-91ed-887e108833a8","58e73fca0cf20d26fa3cd435");

    
    function doInfo(subsysid,infoid){
        var rp = require('request-promise');
            var options= {
                method:'get',
                uri:"http://jnmi.a-radio.cn/QBservice/pages/QBClient/info.do",
                qs:{mode:'2',subsysid:subsysid,infoid:infoid},
                headers:{
                    'User-Agent': 'Request-Promise'
                },
                json: true
            };
            rp(options).then(function(data){
                
                var content;  //content是字符串
                if (typeof(data.result[0].content) != "undefined"){
                    content = data.result[0].content;
                }
                
                var materials = data.result[0].materials;   //materials是素材数组
                
                //console.log(content);
                //console.log("----------------------");

                //定义一个对象，用于存放post到叮咚写库接口的JSON数据
                var objectjson = new Object();
                objectjson.Title = data.result[0].title;
                objectjson.TitleFlag = "0";
                objectjson.TitleFlagName = "热点";
                objectjson.Ctext = data.result[0].tag;
                objectjson.SendMsg = "0";
                objectjson.FileGuid = "10c25ed1-5936-4462-b7bb-7f20d3c7f54c";
                objectjson.F_CRUserIcon = "180ef27b-f9ac-45b7-90a4-5443dc374f3b";
                objectjson.F_CRUserName = data.result[0].author;//"@Radio";
                objectjson.F_CRUser = data.result[0].userid;//"RE964UXL";
                objectjson.ChannelID = "10000000001";
                objectjson.F_CRDATE = "2017-03-31 15:12:52";
                objectjson.F_CHDATE = "2017-03-31 15:12:52";
                objectjson.Status = "2";
                objectjson.OS = "@Radio";
                objectjson.Style = "1";
                objectjson.TagFlagName = data.result[0].type;
                switch (objectjson.TagFlagName){
                    case "体育新闻":
                        objectjson.TagFlag = "news001";
                        break;
                    case "时政新闻":
                        objectjson.TagFlag = "news002";
                        break;
                    case "国内新闻":
                        objectjson.TagFlag = "news003";
                        break;
                    case "国际新闻":
                        objectjson.TagFlag = "news004";
                        break;
                    case "娱乐新闻":
                        objectjson.TagFlag = "news005";
                        break;
                    case "财经新闻":
                        objectjson.TagFlag = "news006";
                        break;
                    case "科技新闻":
                        objectjson.TagFlag = "news007";
                        break;
                    case "时事评论":
                        objectjson.TagFlag = "news008";
                        break;
                    case "社会新闻":
                        objectjson.TagFlag = "news009";
                        break;
                    case "济南新闻":
                        objectjson.TagFlag = "news010";
                        break;
                    case "其他":
                        objectjson.TagFlag = "news011";
                        break;
                    case "图文直播":
                        objectjson.TagFlag = "news012";
                        break;
                    default:
                        objectjson.TagFlag = "news011";
                        break;
                }

                //回写mongoDB，置该条新闻已处理标准位
                var infoObject = new Object();
                infoObject.isDone = "1";
                infoObject.id = data.result[0].id;
                info.updateInfo(infoObject,function(err,infoObject){
                    if (err){
                        throw err;
                    }
                });


                //定义一个变量，存放叮咚的content
                var dingdongContent = "";

                //将所有node节点分离出来
                str = content.split('<root>')[1].split('<\/root>')[0];

                //将node节点切割开来
                str = str.split('<node');
                
                for (var i=1;i<str.length;i++){
                    //将t属性切割出来
                    var t = str[i].split('t=\'')[1].split('\'')[0];

                    //获取serverid
                    var serverid = str[i].split('serverid=\'')[1].split('\'')[0];
                    //console.log(serverid);

                    //如果是文字类型的node，则将body标签之间的内容切割出来，并将\n符号替换掉

                    var docstring = "";
                    if (t == "D"){
                        //console.log(str[i]);
                        if (str[i].indexOf('<\/head>') >= 0){
                            docstring = str[i].split('<\/head>')[1];

                            var  docstring_arr = docstring.split('>');
                            docstring = "";
                            for (var n=1;n<docstring_arr.length;n++){
                                if (docstring == ""){
                                    docstring += docstring_arr[n];
                                }
                                else{
                                    docstring += ">"+docstring_arr[n];
                                }
                                
                            }
                            docstring = docstring.split('<\/body>')[0];
                            //console.log(docstring);
                            //console.log("-------------------------");
                        }
                    }

                    //从materials数组中找到fileid与node中serverid相等的文件下载地址
                    var path="";
                    var filename="";
                    //定义存储音频时长的变量
                    var m_duration="";
                    for (var m=0;m<materials.length;m++){
                        if (serverid==materials[m].fileid)
                        {
                            var url = materials[m].details.url;
                            //把文件的本地路径切割出来
                            path = "./public/file/"+url.split('\/file\/')[1];
                            //console.log(path);
			                var arr = url.split('\/');
                            //把文件名切割出来，用于七牛云的key
                            filename = arr[arr.length-1];
			                //console.log(filename);
                            if (t=="A" || t=="V"){
                                m_duration = parseInt(materials[m].details.duration)*1000;
                            }
                            
                            getTokenAndUpload(filename,path);
                        }
                    }

                    switch(t){
                        case "A":
                            dingdongContent+="<p><video class='edui-upload-video  vjs-default-skin video-js' controls='' preload='none' src='http://pic6.dingdongfm.com/"+filename+"#type=1&auditoDuration="+m_duration+"' data-setup='{}'></video></p>";
                          break;
                        case "V":
                            dingdongContent+="<p><video class='edui-upload-video  vjs-default-skin video-js' controls='' preload='none' src='http://pic6.dingdongfm.com/"+filename+"' data-setup='{}'></video></p>";
                          break;
                        case "P":
                            dingdongContent+="<p><img src='http://pic6.dingdongfm.com/"+filename+"?imageView2/2/w/1000"+"' /></p>";
                            if (objectjson.FileGuid.indexOf('http:') >= 0){
                            }
                            else{
                                objectjson.FileGuid = "http://pic6.dingdongfm.com/"+filename;
                            }
                          break;
                        case "D":
                            dingdongContent+="<p>"+docstring+"</p>";
                          break;
                        default:
                          break;
                    }
                }
                //调用叮咚接口写库
                
                //objectjson.Content = dingdongContent;
                //console.log(dingdongContent);
                dingdongContent = dingdongContent.replace(/\n/g,"");
                //dingdongContent = dingdongContent.replace(/<span class="s1">/g,"");
                dingdongContent = dingdongContent.replace(/<\/span>/g,"");
                //dingdongContent = dingdongContent.replace(/<span dir="auto" class="s1">/g,"");
                //dingdongContent = dingdongContent.replace(/<span class="s2">/g,"");
                //dingdongContent = dingdongContent.replace(/<span>      /g,"");
                //dingdongContent = dingdongContent.replace(/<span class="s3">/g,"");
                //dingdongContent = dingdongContent.replace(/<span class="s4">/g,"");
                //dingdongContent = dingdongContent.replace(/ class="p1"/g,"");
                //dingdongContent = dingdongContent.replace(/ class="p2"/g,"");
                //dingdongContent = dingdongContent.replace(/ class="p3"/g,"");
                //dingdongContent = dingdongContent.replace(/ dir="auto"/g,"");

                //dingdongContent = dingdongContent.replace(/ style="-qt-paragraph-type:empty;/g,"");
                //dingdongContent = dingdongContent.replace(/ margin-top:0px;/g,"");
                //dingdongContent = dingdongContent.replace(/ margin-bottom:0px;/g,"");
                //dingdongContent = dingdongContent.replace(/ margin-left:0px;/g,"");
                //dingdongContent = dingdongContent.replace(/ margin-right:0px;/g,"");

                //dingdongContent = dingdongContent.replace(/ -qt-block-indent:0;/g,"");
                //dingdongContent = dingdongContent.replace(/ text-indent:0px;"/g,"");
                //dingdongContent = dingdongContent.replace(/ style="/g,"");
		
		        dingdongContent = dingdongContent.replace(/<span[^>]*>/g,"");
    		    dingdongContent = dingdongContent.replace(/<p[^>]*>/g,"<p>");
    		    dingdongContent = dingdongContent.replace(/<body[^>]*>/g,"<body>");
                
                objectjson.Content = dingdongContent;
                //objectjson.Content = "在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话在市委十一届一次全会结束时的讲话";
                //objectjson.Content = "The simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by BluebirdThe simplified HTTP request client 'request' with Promise support. Powered by Bluebird";
                //console.log(dingdongContent);
                console.log(objectjson);
                //CreateNews(JSON.stringify(objectjson));
                CreateNews(JSON.stringify(objectjson));
                //console.log(JSON.stringify(objectjson));
            });
    }
    
    
    //调用叮咚接口获取上传七牛文件的token和key
    function getTokenAndUpload(filename,path){
        var rp = require('request-promise');
        var options= {
            method:'post',
            uri:"http://h4.dingdongfm.com/DingDongFM/servlet/GetToken",
            qs:{Type:'newsimgs',Key:filename},
            headers:{
                'Accept-Encoding': 'gzip, deflate, sdch',
                'Accept-Language': 'zh-CN,zh;q=0.8',
                'User-Agent': 'Request-Promise'
            },
            json: true
        };
        rp(options).then(function(data){
            var token = data.ResponseObject.token;
            var url = data.ResponseObject.url;
            //console.log("token:"+token);
            //console.log("url:"+url);

            //调用七牛的函数进行单个文件的上传
            uploadFile(token,filename,path);
        });
    }

    //调用叮咚接口将稿件写入叮咚数据库
    function CreateNews(objectjson){
        
        //console.log(objectjson);
        /*
        var rp = require('request-promise');
        var options= {
            method:'post',
            uri:"http://www.dingdongfm.com/DingDongFM/servlet/CreateNews",
            qs:{ObjectJson:objectjson,ReleaseStatus:'0',SendMsg:'0',SendUserId:'RE964UXL',SendContent:''},
            headers:{
                'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
                //'User-Agent':'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)'
                'User-Agent': 'Request-Promise'
            },
            json: true
        };
        rp(options).then(function(data){
            console.log(data);
        });  */
        var request = require('request');
        request.post('http://h4.dingdongfm.com/DingDongFM/servlet/CreateNews').form({ObjectJson:objectjson,ReleaseStatus:'2',SendMsg:'0',SendUserId:'RE964UXL'});

    }

    //构造上传函数
    function uploadFile(uptoken, key, localFile) {
        var extra = new qiniu.io.PutExtra();
        qiniu.io.putFile(uptoken, key, localFile, extra, function(err, ret) {
          if(!err) {
            // 上传成功， 处理返回值
            console.log(ret.hash, ret.key, ret.persistentId);       
          } else {
            // 上传失败， 处理返回代码
            //重试传送
            uploadFile(uptoken, key, localFile);
            //console.log(err);
          }
        });
    }

});


app.listen(8888);
console.log('Running on port 8888...');
