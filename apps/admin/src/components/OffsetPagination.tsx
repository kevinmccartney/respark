import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';

type OffsetPaginationProps = {
  offset: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export const OffsetPagination = ({
  offset,
  total,
  pageSize,
  loading,
  onPrev,
  onNext,
}: OffsetPaginationProps) => (
  <Pagination className="mt-3 justify-start">
    <PaginationContent className="mx-0">
      <PaginationItem>
        <Button type="button" variant="outline" disabled={offset === 0 || loading} onClick={onPrev}>
          Previous
        </Button>
      </PaginationItem>
      <PaginationItem>
        <Button
          type="button"
          variant="outline"
          disabled={offset + pageSize >= total || loading}
          onClick={onNext}
        >
          Next
        </Button>
      </PaginationItem>
    </PaginationContent>
  </Pagination>
);
