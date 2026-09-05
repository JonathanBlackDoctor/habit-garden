import type { ApplicationDoc } from 'shared/types/firestore';

type StatusApplication = Pick<ApplicationDoc, 'status'>;

export function groupApplicationsByStatus<T extends StatusApplication>(applications: T[]) {
  return {
    active: applications.filter((application) => application.status === 'active'),
    settled: applications.filter((application) => application.status === 'completed'),
    paused: applications.filter((application) => application.status === 'lapsed'),
    archived: applications.filter((application) => application.status === 'archived'),
  };
}
