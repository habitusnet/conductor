import { eq } from 'drizzle-orm';
import { organizations, organizationMembers } from '../schema';
import type { Organization, OrganizationMember } from '@conductor/core';

export function createOrganizationRepository(db: any) {
  return {
    async create(org: Omit<Organization, 'createdAt' | 'updatedAt'>) {
      const result = await db.insert(organizations).values({
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan || 'free',
        billingEmail: org.billingEmail,
        apiKeys: JSON.stringify(org.apiKeys || []),
        settings: JSON.stringify(org.settings || {}),
      }).returning();
      return result[0];
    },

    async findById(id: string) {
      const result = await db.select().from(organizations).where(eq(organizations.id, id));
      return result[0] || null;
    },

    async findBySlug(slug: string) {
      const result = await db.select().from(organizations).where(eq(organizations.slug, slug));
      return result[0] || null;
    },

    async update(id: string, data: Partial<Organization>) {
      const result = await db.update(organizations)
        .set({
          ...data,
          settings: data.settings ? JSON.stringify(data.settings) : undefined,
          apiKeys: data.apiKeys ? JSON.stringify(data.apiKeys) : undefined,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(organizations.id, id))
        .returning();
      return result[0];
    },

    async delete(id: string) {
      await db.delete(organizations).where(eq(organizations.id, id));
    },

    async addMember(member: Omit<OrganizationMember, 'invitedAt' | 'joinedAt'>) {
      const result = await db.insert(organizationMembers).values({
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role || 'member',
      }).returning();
      return result[0];
    },

    async getMembers(organizationId: string) {
      return db.select().from(organizationMembers)
        .where(eq(organizationMembers.organizationId, organizationId));
    },
  };
}
