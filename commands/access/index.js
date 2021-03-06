'use strict';

let cli       = require('heroku-cli-util');
let _         = require('lodash');
let Utils     = require('../../lib/utils');
let co        = require('co');
let orgFlags;

function printJSON (collaborators) {
  cli.log(JSON.stringify(collaborators, null, 2));
}

function printAccess (app, collaborators) {
  let showPrivileges = Utils.isOrgApp(app.owner.email) && (orgFlags.indexOf('org-access-controls') !== -1);
  collaborators = _.chain(collaborators)
  .sortBy(c => c.email || c.user.email)
  .reject(c => /herokumanager\.com$/.test(c.email))
  .map(collab => {
    let email = collab.user.email;
    let role = collab.role === 'viewer' ? 'member' : collab.role;
    let data = { email: email, role: role || 'collaborator' };

    if (showPrivileges) {
      data.privileges = _.map(_.sortBy(collab.privileges, 'name'), 'name');
    }
    return data;
  }).value();

  let columns = [
    {key: 'email', label: 'Email'},
    {key: 'role',  label: 'Role'},
  ];
  if (showPrivileges) columns.push({key: 'privileges', label: 'Privileges'});
  cli.table(collaborators, {columns});
}

function* run (context, heroku) {
  let appName = context.app;

  let app = yield heroku.apps(appName).info();
  let isOrgApp = Utils.isOrgApp(app.owner.email);

  let collaborators = yield heroku.request({
    method: 'GET',
    path: isOrgApp ? `/organizations/apps/${appName}/collaborators` : `/apps/${appName}/collaborators`,
    headers: { Accept: 'application/vnd.heroku+json; version=3.org-privileges' }
  });

  if (isOrgApp) {
    let orgName = Utils.getOwner(app.owner.email);
    let orgInfo = yield heroku.request({
      method: 'GET',
      path: `/v1/organization/${orgName}`,
      headers: { 'accept': 'application/vnd.heroku+json; version=2' }
    });

    orgFlags = orgInfo.flags;
    if (orgFlags.indexOf('org-access-controls') !== -1) {
      try {
        let admins = yield heroku.get(`/organizations/${orgName}/members`);
        admins = _.filter(admins, { 'role': 'admin' });

        let adminPrivileges = yield heroku.request({
          method: 'GET',
          path: '/organizations/privileges',
          headers: { 'accept': 'application/vnd.heroku+json; version=3.org-privileges' }
        });

        admins = _.forEach(admins, function(admin) {
          admin.user = { email: admin.email };
          admin.privileges = adminPrivileges;
          return admin;
        });

        collaborators = _.reject(collaborators, { 'role': 'admin'}); // Admins might have already privileges
        collaborators = _.union(collaborators, admins);
      } catch (err) {
        if (err.statusCode !== 403) throw err;
      }
    }
  }

  if (context.flags.json) printJSON(collaborators);
  else                    printAccess(app, collaborators);
}

module.exports = {
  topic:        'access',
  description:  'TODO',
  needsAuth:    true,
  needsApp:     true,
  flags: [
    {name: 'json', description: 'output in json format'},
  ],
  run:          cli.command(co.wrap(run))
};
