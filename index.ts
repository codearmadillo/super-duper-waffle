/**
 * A simple PoC for a privilege system with types, mock DB, DAO, and tests.
 * The idea is that each user has a set of privileges of various types, areas, and scopes.
 *
 * Essentially, a privilege consists of:
 * <type>:<contextId?>:<area>:<scope>
 *
 * Where...
 * - type is either 'account' or 'project' (essentially a domain)
 * - contextId is a lose identifier for the context of the privilege e.g. projectId for project privileges (accountId is disregarded as it's implicit)
 * - area is a specific business area e.g. user_management, templates, campaigns
 * - scope is the level of access e.g. read, write, execute, delete (in this order)
 */
enum PrivilegeType {
  Account = 'account',
  Project = 'project'
}
enum PrivilegeScope {
  Read = 'read',
  Write = 'write',
  Execute = 'execute',
  Delete = 'delete',
}
const privilegeScopeOrderMap = {
    [PrivilegeScope.Read]: 1,   // identical to 'access' privilege
    [PrivilegeScope.Write]: 2,
    [PrivilegeScope.Execute]: 3,
    [PrivilegeScope.Delete]: 4,
} satisfies Record<PrivilegeScope, number>

enum AccountPrivilegeArea {
  UserManagement = 'user_management',
  Analytics = 'analytics',
  Billing = 'billing'
}
enum ProjectPrivilegeArea {
  Templates = 'templates',
  Audience = 'audience',
  Campaigns = 'campaigns',
}

/**
 * Helper functions for privilege serialization and deserialization
 */
function createAccountPrivilegeWithScope(area: AccountPrivilegeArea, scope: PrivilegeScope) {
  return `${PrivilegeType.Account}:${area}:${scope}`;
}
function decomposeAccountPrivilege(privilegeString: string) {
  const [type, area, scope] = privilegeString.split(':') as [ PrivilegeType.Account, AccountPrivilegeArea, PrivilegeScope ];
  return { type, area, scope };
}
function createProjectPrivilegeWithScope(area: ProjectPrivilegeArea, scope: PrivilegeScope, projectId: string) {
  return `${PrivilegeType.Project}:${projectId}:${area}:${scope}`;
}
function decomposeProjectPrivilege(privilegeString: string) {
  const [type, projectId, area, scope] = privilegeString.split(':') as [ PrivilegeType.Project, string, ProjectPrivilegeArea, PrivilegeScope ];
  return { type, projectId, area, scope };
}

/**
 * Helper functions to check if a user has a specific privilege
 */
function isPrivilegeScopeHigherOrEqual(privilegeA: PrivilegeScope, privilegeB: PrivilegeScope) {
  const orderA = privilegeScopeOrderMap[privilegeA];
  const orderB = privilegeScopeOrderMap[privilegeB];
  return orderA >= orderB;
}
function hasAccountPrivilege(privilegeStringArray: string[], area: AccountPrivilegeArea, scope: PrivilegeScope) {
  const privileges = privilegeStringArray.map(decomposeAccountPrivilege);
  return privileges.some(p => p.type === PrivilegeType.Account && p.area === area && isPrivilegeScopeHigherOrEqual(p.scope, scope));
}
function hasProjectPrivilege(privilegeStringArray: string[], projectId: string, area: ProjectPrivilegeArea, scope: PrivilegeScope) {
  const privileges = privilegeStringArray.map(decomposeProjectPrivilege);
  return privileges.some(p => p.type === PrivilegeType.Project && p.projectId === projectId && p.area === area && isPrivilegeScopeHigherOrEqual(p.scope, scope));
}

// Mock data
const user_guid = '123e4567-e89b-12d3-a456-426614174000'
const project_a_guid = 'eff65ad0-5021-48b2-b8f5-00b3831f219f'
const project_b_guid = '32922ac8-b585-4ead-8867-95d9c2e066f5'

// Mock DB schema
class PrivilegeRow {
  readonly userId: string;
  readonly type: PrivilegeType
  readonly area: AccountPrivilegeArea | ProjectPrivilegeArea;
  readonly scope: PrivilegeScope
  readonly contextId: string | null; // null for account, projectId for project
  constructor(userId: string, type: PrivilegeType, area: AccountPrivilegeArea | ProjectPrivilegeArea, scope: PrivilegeScope, contextId: string | null = null) {
    this.userId = userId;
    this.type = type;
    this.area = area;
    this.scope = scope;
    this.contextId = contextId;
  }
}

// Sample DAO
// Returns privilege string
function getUserPrivilegeStringArray(userId: string) {
  const entities = database.privileges.filter((privilege) => privilege.userId === userId);
  // map privileges to privilege strings
  return entities.map((privilege) => {
    if (privilege.type === PrivilegeType.Account) {
      return createAccountPrivilegeWithScope(privilege.area as AccountPrivilegeArea, privilege.scope);
    }
    if (privilege.type === PrivilegeType.Project) {
      if (privilege.contextId === null) {
        throw new Error('Project privilege must have a contextId (projectId)');
      }
      return createProjectPrivilegeWithScope(privilege.area as ProjectPrivilegeArea, privilege.scope, privilege.contextId!);
    }
    throw new Error('Unknown privilege type');
  })
}

/**
 * ------------------------------------------------------------
 * Bingo bongo test!
 * ------------------------------------------------------------
 * 1. Define all necessary types and test suites
 * 2. Create mock database with privileges
 * 3. Query privileges for user
 * 4. Create tests to check if user has privileges
 * 5. Print results in table
 */

// 1. Define all necessary types and test suites
type AccountPrivilegeTest = [ PrivilegeType.Account, AccountPrivilegeArea, PrivilegeScope, null, boolean ]
type ProjectPrivilegeTest = [ PrivilegeType.Project, ProjectPrivilegeArea, PrivilegeScope, string, boolean ];
type PrivilegeTest = AccountPrivilegeTest | ProjectPrivilegeTest;
const tests = [
  [ PrivilegeType.Account, AccountPrivilegeArea.UserManagement, PrivilegeScope.Write, null, true ],
  [ PrivilegeType.Account, AccountPrivilegeArea.UserManagement, PrivilegeScope.Delete, null, true ],
  [ PrivilegeType.Account, AccountPrivilegeArea.UserManagement, PrivilegeScope.Execute, null, true ],
  [ PrivilegeType.Account, AccountPrivilegeArea.Analytics, PrivilegeScope.Read, null, true ],
  [ PrivilegeType.Account, AccountPrivilegeArea.Analytics, PrivilegeScope.Write, null, true ],
  [ PrivilegeType.Account, AccountPrivilegeArea.Analytics, PrivilegeScope.Delete, null, false ],
  [ PrivilegeType.Project, ProjectPrivilegeArea.Campaigns, PrivilegeScope.Read, project_a_guid, true ],
  [ PrivilegeType.Project, ProjectPrivilegeArea.Campaigns, PrivilegeScope.Write, project_a_guid, true ],
  [ PrivilegeType.Project, ProjectPrivilegeArea.Campaigns, PrivilegeScope.Execute, project_a_guid, false ],
  [ PrivilegeType.Project, ProjectPrivilegeArea.Audience, PrivilegeScope.Read, project_b_guid, true ],
  [ PrivilegeType.Project, ProjectPrivilegeArea.Audience, PrivilegeScope.Write, project_b_guid, false ],
  [ PrivilegeType.Project, ProjectPrivilegeArea.Audience, PrivilegeScope.Delete, project_b_guid, false ],
] as PrivilegeTest[]
class TableResult {
  type: string;
  area: string
  scope: string;
  contextId: string | null
  expected: boolean;
  result: boolean
  pass: boolean;
  constructor(type: string, area: string, scope: string, contextId: string | null, expected: boolean, result: boolean, pass: boolean) {
    this.type = type;
    this.area = area;
    this.scope = scope;
    this.contextId = contextId;
    this.expected = expected;
    this.result = result;
    this.pass = pass;
  }
}

// 2. Create mock database with privileges
const database = {
  privileges: [
    new PrivilegeRow(user_guid, PrivilegeType.Account, AccountPrivilegeArea.UserManagement, PrivilegeScope.Delete),
    new PrivilegeRow(user_guid, PrivilegeType.Account, AccountPrivilegeArea.Analytics, PrivilegeScope.Execute),
    new PrivilegeRow(user_guid, PrivilegeType.Project, ProjectPrivilegeArea.Campaigns, PrivilegeScope.Write, project_a_guid),
    new PrivilegeRow(user_guid, PrivilegeType.Project, ProjectPrivilegeArea.Audience, PrivilegeScope.Read, project_b_guid),
  ]
}

// 3. Query privileges for user
const userPrivileges = getUserPrivilegeStringArray(user_guid)

// 4. Create tests to check if user has privileges
const rows = []
for (const [ type, area, scope, contextId, expected ] of tests) {
  let result: boolean;
  if (type === PrivilegeType.Account) {
    result = hasAccountPrivilege(userPrivileges, area as AccountPrivilegeArea, scope);
  } else {
    result = hasProjectPrivilege(userPrivileges, contextId!, area as ProjectPrivilegeArea, scope);
  }
  rows.push(new TableResult(type, area, scope, contextId, expected, result, result === expected));
}

// 5. Print results in table
console.table(rows);
