exports.topics = [
  {name: 'access', description: 'CLI to manage access in Heroku Applications'},
  {name: 'sharing', hidden: true},
];

exports.commands = [
  require('./commands/access'),
  require('./commands/access/add'),
  require('./commands/access/remove'),
  require('./commands/access/update'),
  require('./commands/apps/transfer'),
  require('./commands/apps/transfer').sharing,
];
