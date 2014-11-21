var marked = require('marked'),
  md5 = require('MD5');

module.exports = function(grunt) {
'use strict';

//------------------------------------------------------------------------------
// Snowflake CSS
// TODO: this should become it's own module and published on npm
//------------------------------------------------------------------------------

function keys(o) {
  var a = [];
  for (var i in o) {
    if (o.hasOwnProperty(i) !== true) continue;
    a.push(i);
  }
  return a;
}

function arrToObj(arr) {
  var o = {};
  for (var i = 0; i < arr.length; i++) {
    o[ arr[i] ] = null;
  }
  return o;
}

function difference(arr1, arr2) {
  var o1 = arrToObj(arr1);
  var o2 = arrToObj(arr2);
  var delta = [];

  for (var i in o1) {
    if (o1.hasOwnProperty(i) !== true) continue;

    if (o2.hasOwnProperty(i) !== true) {
      delta.push(i)
    }
  }

  for (var i in o2) {
    if (o2.hasOwnProperty(i) !== true) continue;

    if (o1.hasOwnProperty(i) !== true) {
      delta.push(i)
    }
  }

  return delta.sort();
}

// Snowflake class names must contain at least one letter and one number
function hasNumbersAndLetters(str) {
  if (str.search(/\d/) === -1) {
    return false;
  }

  if (str.search(/[a-z]/) === -1) {
    return false;
  }

  return true;
}

// returns an array of unique Snowflake classes from a file
function extractSnowflakeClasses(filename, pattern) {
  if (! pattern) {
    pattern = /([a-z0-9]+-){1,}([abcdef0-9]){5}/g;
  }

  var fileContents = grunt.file.read(filename);
  var classes = {};

  var matches = fileContents.match(pattern);

  if (matches) {
    for (var i = 0; i < matches.length; i++) {
      var c = matches[i];

      if (hasNumbersAndLetters(c) === true) {
        classes[c] = null;
      }
    }
  }

  return keys(classes);
}

function snowflakeCount() {
  var cssClasses = extractSnowflakeClasses("public/css/main.min.css"),
    jsServer = extractSnowflakeClasses("app.js"),
    jsClient = extractSnowflakeClasses('public/js/client.min.js'),
    jsClasses = jsServer.concat(jsClient);

  console.log(cssClasses.length + " class names found in css/main.min.css");
  console.log(jsClasses.length + " class names found in JS files");

  console.log("Classes found in one file but not the other:");
  console.log( difference(jsClasses, cssClasses) );
}

//------------------------------------------------------------------------------
// Doc Files
//------------------------------------------------------------------------------

function extractNamespace(fullName) {
  fullName = fullName + "";
  var slash = fullName.indexOf("/");
  return fullName.substr(0, slash);
}

function extractName(fullName) {
  fullName = fullName + "";
  var slash = (fullName + "").indexOf("/");
  return fullName.substr(slash + 1);
}

function isSectionLine(line) {
  return (line.search(/^=====/) !== -1);
}

function convertArraySection(s) {
  if (s === "") {
    return [];
  }

  var arr1 = s.split("\n"),
    arr2 = [];

  for (var i = 0; i < arr1.length; i++) {
    if (arr1[i] === "") continue;

    arr2.push(arr1[i]);
  }

  return arr2;
}

function transformFn(fn) {
  // extract namespace and function name from the full name
  fn["full-name"] = fn["function"];
  fn["namespace"] = extractNamespace(fn["function"]);
  fn["name"] = extractName(fn["function"]);
  delete fn["function"];

  // parse description as Markdown
  fn["description-html"] = marked(fn["description"]);
  delete fn["description"];

  // convert some sections into arrays
  fn.signature = convertArraySection(fn.signature);

  if (fn.hasOwnProperty("related") === true) {
    fn.related = convertArraySection(fn.related);
  }

  return fn;
}

function parseDocFile(fileContent) {
  var contentArr = fileContent.split("\n"),
    currentSection = false,
    fn = {};

  for (var i = 0; i < contentArr.length; i++) {
    var line = contentArr[i];

    if (isSectionLine(line) === true) {
      currentSection = line.replace(/^=====/, "").trim().toLowerCase();
      fn[currentSection] = "";
      continue;
    }

    if (currentSection === false) continue;

    fn[currentSection] += line + "\n";
  }

  // trim everything
  for (var i in fn) {
    if (fn.hasOwnProperty(i) !== true) continue;

    fn[i] = fn[i].trim();
  }

  return fn;
}

// quick check that the format is correct
function validFn(fn) {
  return fn.hasOwnProperty("function") &&
         fn.hasOwnProperty("signature") &&
         fn.hasOwnProperty("description");
}

function buildDocs() {
  var docs = {};

  grunt.file.recurse("docs", function(abspath) {
    // skip non .cljsdoc files
    if (abspath.search(/\.cljsdoc$/) === -1) return;

    var fileContent = grunt.file.read(abspath),
      fn = parseDocFile(fileContent);

    // quick sanity check that fn is a good format
    if (validFn(fn) !== true) return;

    // clean and transform the data
    fn = transformFn(fn);

    docs[fn["full-name"]] = fn;
  });

  grunt.file.write("public/docs.json", JSON.stringify(docs, null, 2));
}

//------------------------------------------------------------------------------
// Grunt Config
//------------------------------------------------------------------------------

grunt.initConfig({

  clean: {
    options: {
      force: true
    },

    // remove all the files in the 00-publish folder
    pre: ['00-publish']
  },

  copy: {
    cheatsheet: {
      files: [
        { src: 'public/cheatsheet/index.html', dest: '00-publish/cheatsheet/index.html' },
        { src: 'public/css/main.min.css', dest: '00-publish/css/main.min.css' },
        { src: 'public/fonts/*', dest: '00-publish/fonts/', expand: true, flatten: true },
        { src: 'public/img/*', dest: '00-publish/img/', expand: true, flatten: true },
        { src: 'public/js/cheatsheet.min.js', dest: '00-publish/js/cheatsheet.min.js' },
        { src: 'public/js/libs/jquery-2.1.1.min.js', dest: '00-publish/js/libs/jquery-2.1.1.min.js' },
        { src: 'public/favicon.png', dest: '00-publish/favicon.png' }
      ]
    }
  },

  less: {
    options: {
      compress: true
    },

    watch: {
      files: {
        'public/css/main.min.css': 'less/main.less'
      }
    }
  },

  watch: {
    options: {
      atBegin: true
    },

    less: {
      files: "less/*.less",
      tasks: "less:watch"
    },

    docs: {
      files: "docs/*.cljsdoc",
      tasks: "build-docs"
    }
  }

});

function hashCheatsheetFiles() {
  var cssFile = grunt.file.read('00-publish/css/main.min.css'),
    cssHash = md5(cssFile).substr(0, 8),
    jsFile = grunt.file.read('00-publish/js/cheatsheet.min.js'),
    jsHash = md5(jsFile).substr(0, 8),
    htmlFile = grunt.file.read('00-publish/cheatsheet/index.html');

  // write the new files
  grunt.file.write('00-publish/css/main.min.' + cssHash + '.css', cssFile);
  grunt.file.write('00-publish/js/cheatsheet.min.' + jsHash + '.js', jsFile);

  // delete the old files
  grunt.file.delete('00-publish/css/main.min.css');
  grunt.file.delete('00-publish/js/cheatsheet.min.js');

  // update the HTML file
  grunt.file.write('00-publish/cheatsheet/index.html',
    htmlFile.replace('main.min.css', 'main.min.' + cssHash + '.css')
    .replace('cheatsheet.min.js', 'cheatsheet.min.' + jsHash + '.js'));
}

// load tasks from npm
grunt.loadNpmTasks('grunt-contrib-clean');
grunt.loadNpmTasks('grunt-contrib-copy');
grunt.loadNpmTasks('grunt-contrib-less');
grunt.loadNpmTasks('grunt-contrib-watch');

grunt.registerTask('build-docs', buildDocs);
grunt.registerTask('hash-cheatsheet', hashCheatsheetFiles);

grunt.registerTask('build-cheatsheet', [
  'clean:pre',
  'less',
  'copy:cheatsheet',
  'hash-cheatsheet'
]);

grunt.registerTask('snowflake', snowflakeCount);
grunt.registerTask('default', 'less');

// end module.exports
};