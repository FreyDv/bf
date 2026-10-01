// Opens Postgres (5432) for YOUR current public IP and nobody else. Run it again whenever your IP changes:
// the previous address is removed, so the developer security group always holds exactly one /32.
// Usage: pnpm db:allow-me            (--revoke closes it again)
import {
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  EC2Client,
  RevokeSecurityGroupIngressCommand,
} from '@aws-sdk/client-ec2';

import { main, sdk } from './_lib.ts';
import { config, names } from '../lib/config.ts';

const ec2 = new EC2Client(sdk);

main(async () => {
  const { SecurityGroups = [] } = await ec2.send(
    new DescribeSecurityGroupsCommand({
      Filters: [{ Name: 'group-name', Values: [names.dbDevSecurityGroup] }],
    }),
  );
  const group = SecurityGroups[0];
  if (!group)
    throw new Error(
      `security group ${names.dbDevSecurityGroup} not found — is ${names.stack} deployed?`,
    );

  if (group.IpPermissions?.length) {
    await ec2.send(
      new RevokeSecurityGroupIngressCommand({
        GroupId: group.GroupId,
        IpPermissions: group.IpPermissions,
      }),
    );
    const old = group.IpPermissions.flatMap((p) => p.IpRanges ?? []).map((r) => r.CidrIp);
    console.log(`removed ${old.join(', ')}`);
  }
  if (process.argv.includes('--revoke'))
    return console.log('database is closed to developer access');

  const ip = (await (await fetch('https://checkip.amazonaws.com')).text()).trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))
    throw new Error(`unexpected answer from checkip: "${ip}"`);
  await ec2.send(
    new AuthorizeSecurityGroupIngressCommand({
      GroupId: group.GroupId,
      IpPermissions: [
        {
          IpProtocol: 'tcp',
          FromPort: 5432,
          ToPort: 5432,
          IpRanges: [{ CidrIp: `${ip}/32`, Description: `dev access ${new Date().toISOString()}` }],
        },
      ],
    }),
  );
  console.log(
    `allowed ${ip}/32 → ${config.domains.db}:5432   (connection string: pnpm db:url <database>)`,
  );
});
