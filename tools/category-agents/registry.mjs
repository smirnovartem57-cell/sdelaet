import * as research from './agents/research-agent.mjs';
import * as domain from './agents/domain-expert-agent.mjs';
import * as intake from './agents/intake-designer-agent.mjs';
import * as brief from './agents/contractor-brief-agent.mjs';
import * as compare from './agents/comparison-architect-agent.mjs';
import * as qa from './agents/technical-qa-agent.mjs';
import * as regression from './agents/regression-agent.mjs';
import * as release from './agents/release-controller-agent.mjs';

export const productionAgents=[research,domain,intake,brief,compare,qa,regression];
export const releaseController=release;
export const allAgents=[...productionAgents,releaseController];
