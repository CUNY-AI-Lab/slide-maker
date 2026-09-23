import { sqlite } from '../src/db/index.js'
import { migrateIdentityMapping } from '../src/db/identity-mapping.js'
migrateIdentityMapping(sqlite)
sqlite.close()
