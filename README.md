# swagger_token


## Overview

Sample application SecurityDefinition-enabled swagger API document.


## Setup

- Edit settings.js for your prefered DB.

    - If you are going to use IBM Cloudant, you need to set **exports.db_username** and **exports.db_password** as your username and password for IBM Cloudant.

    - If you are going to use Apache CouchDB, you need to set **exports.db_host**, **exports.db_protocol**, and **exports.db_port** as your Apache CouchDB server. You may need to edit **exports.db_username** and **exports.db_password** too when they are not blank.

    - Edit **exports.sample_username** and **exports.sample_password** for sample valid user id and password.

- Edit public/doc/swagger.yaml host value for your application server.


## References

https://qiita.com/poruruba/items/a384b34408fbba3b5e47


## Copyright

2018 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
