import { calculateRiskScores, RiskAnalysisNode, RiskAnalysisLink } from './riskScoring';

const blacklistAddr = '0x1234567890123456789012345678901234567890';
const nodes: RiskAnalysisNode[] = [
    { id: blacklistAddr, group: 'Wallet' },
    { id: '0xSafeWallet', group: 'Wallet' }
];

const links: RiskAnalysisLink[] = [];

console.log('Running Risk Scoring Test...');
const results = calculateRiskScores(nodes, links);

const blockedStats = results.get(blacklistAddr.toLowerCase());
console.log('Blacklisted Wallet Risk:', blockedStats);

if (blockedStats && blockedStats.score === 100 && blockedStats.reasons.has('Blacklisted Wallet Address')) {
    console.log('SUCCESS: Blacklisted wallet has score 100 and correct reason');
} else {
    console.error('FAILURE: Blacklisted wallet stats unexpected:', blockedStats);
    process.exit(1);
}
