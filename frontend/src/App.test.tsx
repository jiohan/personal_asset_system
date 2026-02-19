import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders bootstrap title', () => {
    render(<App />);
    expect(screen.getByText('Personal Asset Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Walking Skeleton' })).toBeInTheDocument();
  });
});
