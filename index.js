const fs = require('fs');
const port = 9002;
const request = require('request');
const admZip = require('adm-zip');
const path = require('path');
const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors')


const readFiles = (dir, name, done) => {
  var results = {};
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);

    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          readFiles(file, name, function(err, res) {
            results = {...results, ...res};
            if (!--pending) done(null, results);
          });
        } else {
          const pathKey = file.split(`tmp/${name}/`)[1];
          // if(file.match(/\.(svg|png|jpg|jpeg)$/)) {
          //   results[pathKey] = pathKey;
          // } else if(!file.match('package-lock.json')) {    
          const data = fs.readFileSync(file,'utf8');
          results[pathKey] = data;
          // }
          if (!--pending) done(null, results);
        }
      });
    });

  });
}

const unzipFile = async (file, name) => {
  const zip = new admZip(file);
  const dirName = `tmp/${name}`
  return new Promise((resolve, rej) => {
    zip.extractAllToAsync(dirName, true, (err) => {
      readFiles(dirName, name, function (err, res) {
        if(err) {
          return rej(err);
        }
        return resolve(res);
      });
    });  
  });
};

const createFile = async (url) => {
  const fileName = `tempProject-${Math.ceil(Math.random()*1000)}`;
  const output = `tmp/${fileName}.zip`;
  return new Promise((res,rej) => {
    request({url: url, encoding: null}, function(err, resp, body) {
      if(err) return rej(err);
      fs.writeFile(output, body, function(err) {
        unzipFile(output, fileName).then(data => {

          fs.writeFile(`public/${fileName}.json`, JSON.stringify(data), err => {
            if(err) {
              return rej(err);
            }
            return res(`${fileName}.json`);
          })
        });
      });
    });
  })
};

const server = express();
server.use(bodyParser.json());
server.use(cors());
server.use(express.static('public'));
server.post('/get-files', async (req, res, next)=> {
  if(!req.body.file) {
    return res.send(422, {
      error: 'File param is needed'
    });
  };
  const {file} = req.body;
  try {
    const json = await createFile(file);
    return res.json(200,{
      result: json
    })
  }catch(err) {
    return res.send(500, err);
  }
});
server.listen(port, function() {
  console.log('%s listening at %s', server.name, port);
});