import { ShieldCheck } from 'lucide-react';
import { TEAM_MEMBERS, initialsFor, type TeamMember } from '../data/team';

/**
 * Team grid for /about.
 *
 * Renders nothing while `TEAM_MEMBERS` is empty, so the page never shows an
 * empty photo box, a "team photo coming soon" card or a stock face. A member
 * without a photograph gets their initials; a member without a bio simply has
 * no bio line. Every field is optional except name and role.
 */
export default function TeamSection() {
  if (TEAM_MEMBERS.length === 0) return null;

  // Two columns at three or fewer, three above that — keeps a short team from
  // stranding a lone card on its own row.
  const columns = TEAM_MEMBERS.length <= 3 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="bg-surface px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-royal-600">
          The team
        </p>
        <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">
          Who comes to your property
        </h2>
        <ul className={`mt-9 grid gap-6 ${columns}`}>
          {TEAM_MEMBERS.map((member) => (
            <TeamCard key={member.name} member={member} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function TeamCard({ member }: { member: TeamMember }) {
  return (
    <li className="rounded-3xl border border-line bg-white p-6">
      <div className="flex items-center gap-4">
        {member.photo ? (
          <img
            src={member.photo}
            alt={`${member.name}, ${member.role} at VVE Clean`}
            loading="lazy"
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          // Initials rather than a placeholder silhouette: it reads as a
          // deliberate design, not a missing asset.
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-royal-500 font-display text-lg font-bold text-white"
          >
            {initialsFor(member.name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-navy-900">{member.name}</h3>
          <p className="text-sm text-muted">{member.role}</p>
        </div>
      </div>

      {member.bio && <p className="mt-4 text-sm leading-6 text-ink">{member.bio}</p>}

      {(member.experience || member.training || member.dbsChecked) && (
        <dl className="mt-4 space-y-2 text-sm">
          {member.experience && (
            <div>
              <dt className="sr-only">Experience</dt>
              <dd className="text-muted">{member.experience}</dd>
            </div>
          )}
          {member.training && (
            <div>
              <dt className="sr-only">Training</dt>
              <dd className="text-muted">{member.training}</dd>
            </div>
          )}
          {member.dbsChecked && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Background check</dt>
              <dd className="flex items-center gap-2 font-medium text-navy-900">
                <ShieldCheck className="shrink-0 text-royal-500" size={16} aria-hidden="true" />
                DBS checked
              </dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}
