'use strict';
import { spawn } from 'child_process';
import through from 'through2';
import split from 'split2';
import traverse from 'traverse';
import {format as toArgv} from 'argv-formatter';
import combine from 'stream-combiner2';
import fwd from 'spawn-error-forwarder';

export const config = {
  commit: {
    long: 'H',
    short: 'h'
  },
  tree: {
    long: 'T',
    short: 't'
  },
  author: {
    name: 'an',
    email: 'ae',
    date: {
      key: 'ai',
      type: Date
    }
  },
  committer: {
    name: 'cn',
    email: 'ce',
    date: {
      key: 'ci',
      type: Date
    }
  },
  subject: 's',
  body: 'b'
};

export function mapFields () {
  return traverse.reduce(config, function (fields, node) {
    if (this.isLeaf && typeof node === 'string') {
      var typed = this.key === 'key';
      fields.push({
        path: typed ? this.parent.path : this.path,
        key: node,
        type: this.parent.node.type
      });
    }
    return fields;
  }, []);
};

var START = '==START==';
var FIELD = '==FIELD==';

function format (fieldMap) {
  return START + fieldMap.map(function (field) {
      return '%' + field.key;
    })
    .join(FIELD) ;
}

function trim () {
  return through(function (chunk, enc, callback) {
    if (!chunk) {
      callback();
    }
    else {
      callback(null, chunk);
    }
  });
}

function log (args, options) {
  return fwd(spawn('git', ['log',...args,'-m', '--name-status'], options), function (code, stderr) {
    return new Error('git log failed:\n\n' + stderr);
  })
  .stdout;
}

function args (config, fieldMap) {
  config.format = format(fieldMap);
  return toArgv(config);
}

const fileChangeRegex = new RegExp('\\s+([A-Z]+)\\s+(.*)','gm')

function extractFiles(chunk){
  const files = [];
  let match;

  while ((match = fileChangeRegex.exec(chunk)) !== null) {
    const status = match[1];
    const path = match[2];
    
    files.push({ status, path });
  }

  return files;
}

export function parse (config, options) {
  config  = config || {};
  var map = mapFields();
  return combine.obj([
    log(args(config, map), options),
    split(START),
    trim(),
    through.obj(function (chunk, enc, callback) {
      const textChunk = chunk.toString('utf8');
      const files = extractFiles(textChunk);
      var fields = textChunk.split(FIELD);
      const reduced = map.reduce(function (parsed, field, index) {
        var value = fields[index];
        traverse(parsed).set(field.path, field.type ? new field.type(value) : value);
        parsed.files = files;
        return parsed;
      })
      callback(null, reduced, {});
    })
  ]);
};

export const fields = config;
