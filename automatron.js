/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  cb(null, { hello: context.query.name || 'Anonymous' });
};