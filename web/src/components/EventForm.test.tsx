import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { emptyValues } from '../lib/eventForm';
import { EventForm } from './EventForm';

const setup = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<EventForm initialValues={emptyValues} submitLabel="Publish" onSubmit={onSubmit} onCancel={() => {}} />);
  return { onSubmit, user: userEvent.setup() };
};

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Title'), 'Rooftop jazz');
  await user.click(screen.getByRole('radio', { name: /Music/ }));
  await user.type(screen.getByLabelText('Date'), '2099-01-15');
  await user.type(screen.getByLabelText('Start time'), '19:30');
  await user.type(screen.getByLabelText('Location'), 'Skyline Terrace');
  await user.type(screen.getByLabelText('Description'), 'Live trio playing standards.');
}

describe('EventForm', () => {
  it('shows validation errors and does not submit an empty form', async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Give your event a title/)).toBeInTheDocument();
    expect(screen.getByText('Pick a category')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits a typed API payload', async () => {
    const { onSubmit, user } = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Rooftop jazz', category: 'music', capacity: null, endsAt: null }),
    );
  });

  it('renders server-side field errors next to the right input', async () => {
    const err = new ApiError(422, 'VALIDATION_FAILED', 'Please fix the highlighted fields', {
      'location.name': 'That venue is closed',
    });
    const { user } = setup(vi.fn().mockRejectedValue(err));
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('That venue is closed')).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toHaveAttribute('aria-invalid', 'true');
  });
});
